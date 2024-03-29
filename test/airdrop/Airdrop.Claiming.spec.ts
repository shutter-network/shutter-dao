import { expect } from 'chai';
import { deployments, ethers, waffle } from 'hardhat';
import '@nomiclabs/hardhat-ethers';
import {
  deployTestToken,
  getAirdropContract,
  getVestingLibraryContract,
  getVestingPoolContract,
  getVestingPoolManagerContract,
} from '../utils/setup';
import { Vesting } from '../../src/utils/types';
import { calculateVestingHash } from '../../src/utils/hash';
import { BigNumber, Contract, Wallet } from 'ethers';
import { generateRoot, generateProof } from '../../src/utils/proof';
import { setNextBlockTime } from '../utils/state';

describe('Airdrop - Claiming', async () => {
  const vestingDurationInWeeks = 208;
  const vestingDuration = vestingDurationInWeeks * 7 * 24 * 60 * 60;
  const currentTime = Math.floor(new Date().getTime() / 1000) + 1000;
  const vestingStart = currentTime - vestingDuration / 2;
  const redeemDeadline = currentTime + 60 * 60;
  const users = waffle.provider.getWallets();
  const [airdropManager, user1, user2] = users;

  const setupTest = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture(['ShutterToken', 'VestingLibrary']);
    const airdropContract = await getAirdropContract();
    const token = await deployTestToken(airdropManager.address);
    const vestingLibraryContract = await getVestingLibraryContract();
    const vestingLibrary = await vestingLibraryContract.deploy();
    const poolContract = await getVestingPoolContract(vestingLibrary.address);
    const vestingPool = await poolContract.deploy(token.address);
    const vestingPoolManagerContract = await getVestingPoolManagerContract();
    const vestingPoolManager = await vestingPoolManagerContract.deploy(
      token.address,
      vestingPool.address,
      airdropManager.address,
    );

    return {
      token,
      airdropContract,
      vestingPoolManager,
    };
  });

  const createVesting = (account: string, amount: BigNumber, startDate: number): Vesting => {
    return {
      owner: account,
      curveType: 0,
      managed: false,
      durationWeeks: vestingDurationInWeeks,
      startDate,
      amount,
      initialUnlock: 0,
      requiresSPT: false
    };
  };

  const generateAirdrop = async (
    amount: BigNumber,
    startDate: number = vestingStart,
  ): Promise<{ root: string; elements: string[] }> => {
    const elements = users
      .map(u => u.address)
      .map((account: string) => {
        return createVesting(account, amount, startDate);
      })
      .map((vesting: Vesting) => {
        return calculateVestingHash(vesting);
      });
    const root = generateRoot(elements);
    return {
      root,
      elements,
    };
  };

  const setupAirdrop = async (
    amount: BigNumber = ethers.utils.parseUnits('200000', 18),
    startDate: number = vestingStart,
    fund: boolean = true,
  ) => {
    const { airdropContract, vestingPoolManager, token } = await setupTest();
    const { root, elements } = await generateAirdrop(amount, startDate);
    const airdrop = await airdropContract.deploy(
      token.address,
      airdropManager.address,
      redeemDeadline,
      vestingPoolManager.address,
      root,
    );

    if (fund) {
      await token.transfer(airdrop.address, amount);
    }
    return { airdrop, elements, root };
  };

  const redeemAirdrop = async (
    airdrop: Contract,
    elements: string[],
    user: Wallet,
    amount: BigNumber = ethers.utils.parseUnits('200000', 18),
    startDate: number = vestingStart,
  ): Promise<{ vesting: Vesting; vestingHash: string }> => {
    const vesting = createVesting(user.address, amount, startDate);
    const vestingHash = calculateVestingHash(vesting);
    const proof = generateProof(elements, vestingHash);
    await airdrop
      .connect(user)
      .redeem(
        vesting.curveType,
        vesting.durationWeeks,
        vesting.startDate,
        vesting.amount,
        vesting.initialUnlock,
        proof,
        false,
      );
    return { vesting, vestingHash };
  };

  describe('claimUnusedTokens', async () => {
    it('should revert if called before redeem deadline', async () => {
      const { airdrop } = await setupAirdrop();
      await expect(airdrop.claimUnusedTokens(user2.address)).to.be.revertedWith(
        'Tokens can still be redeemed',
      );
    });

    it('should revert if no tokens to claim', async () => {
      const { airdrop } = await setupAirdrop(undefined, undefined, false);
      await setNextBlockTime(redeemDeadline + 1);
      await expect(airdrop.claimUnusedTokens(user2.address)).to.be.revertedWith(
        'No tokens to claim',
      );
    });

    it('should revert if no tokens to claim after a vesting was created', async () => {
      const { token } = await setupTest();
      const amount = ethers.utils.parseUnits('200000', 18);
      const { airdrop, elements } = await setupAirdrop(amount);

      expect(await token.balanceOf(airdrop.address)).to.be.eq(amount);
      await redeemAirdrop(airdrop, elements, user1, amount);
      expect(await token.balanceOf(user2.address)).to.be.eq(0);
      await setNextBlockTime(redeemDeadline + 1);
      await expect(airdrop.claimUnusedTokens(user2.address)).to.be.revertedWith(
        'No tokens to claim',
      );
    });

    it('should be able to claim if no vesting was created', async () => {
      const { token } = await setupTest();
      const amount = ethers.utils.parseUnits('200000', 18);
      const { airdrop } = await setupAirdrop(amount);

      expect(await token.balanceOf(airdrop.address)).to.be.eq(amount);
      expect(await token.balanceOf(user2.address)).to.be.eq(0);
      await setNextBlockTime(redeemDeadline + 1);
      await expect(airdrop.claimUnusedTokens(user2.address))
        .to.emit(token, 'Transfer')
        .withArgs(airdrop.address, user2.address, amount);
      expect(await token.balanceOf(airdrop.address)).to.be.eq(0);
      expect(await token.balanceOf(user2.address)).to.be.eq(amount);
    });

    it('should be able to claim if tokens left ofter after vesting was created', async () => {
      const { token } = await setupTest();
      const amount = ethers.utils.parseUnits('200000', 18);
      const { airdrop, elements } = await setupAirdrop(amount);
      const leftOver = ethers.utils.parseUnits('100000', 18);
      await token.transfer(airdrop.address, leftOver);

      expect(await token.balanceOf(airdrop.address)).to.be.eq(amount.add(leftOver));
      await redeemAirdrop(airdrop, elements, user1, amount);
      expect(await token.balanceOf(user2.address)).to.be.eq(0);
      await setNextBlockTime(redeemDeadline + 1);
      await expect(airdrop.claimUnusedTokens(user2.address))
        .to.emit(token, 'Transfer')
        .withArgs(airdrop.address, user2.address, leftOver);
      expect(await token.balanceOf(airdrop.address)).to.be.eq(0);
      expect(await token.balanceOf(user2.address)).to.be.eq(leftOver);
    });

    it('should be able to claim if vesting was created', async () => {
      const { token } = await setupTest();
      const amount = ethers.utils.parseUnits('200000', 18);
      const { airdrop, elements } = await setupAirdrop(amount);

      expect(await token.balanceOf(airdrop.address)).to.be.eq(amount);
      await redeemAirdrop(airdrop, elements, user1, amount);
      expect(await token.balanceOf(user2.address)).to.be.eq(0);

      await setNextBlockTime(redeemDeadline + 1);
      await expect(airdrop.claimUnusedTokens(user2.address)).to.be.revertedWith(
        'No tokens to claim',
      );
      expect(await token.balanceOf(user2.address)).to.be.eq(0);
    });
  });
});
