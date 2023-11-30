import { expect } from 'chai';
import { deployments, ethers, waffle } from 'hardhat';
import '@nomiclabs/hardhat-ethers';
import {
  deployTestToken,
  getAirdropContract,
  getExecutor,
  getMock,
  getTestTokenContract,
  getVestingLibraryContract,
  getVestingPoolContract,
  getVestingPoolManagerContract,
} from '../utils/setup';
import { Vesting } from '../../src/utils/types';
import { calculateVestingHash } from '../../src/utils/hash';
import { BigNumber, Contract, Wallet } from 'ethers';
import { generateRoot, generateProof } from '../../src/utils/proof';
import { setNextBlockTime } from '../utils/state';
import { logGas } from '../utils/gas';

describe('Airdrop - Claiming', async () => {
  const vestingDurationInWeeks = 208;
  const vestingDuration = vestingDurationInWeeks * 7 * 24 * 60 * 60;
  const currentTime = Math.floor(new Date().getTime() / 1000) + 1000;
  const vestingStart = currentTime - vestingDuration / 2;
  const vestingEnd = currentTime + vestingDuration / 2;
  const redeemDeadline = currentTime + 60 * 60;
  const users = waffle.provider.getWallets();
  const [airdropManager, user1, user2] = users;

  const setupTestsWithoutExecutor = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture();
    const airdropContract = await getAirdropContract();
    const token = await deployTestToken(airdropManager.address);
    const vestingLibraryContract = await getVestingLibraryContract();
    const vestingLibrary = await vestingLibraryContract.deploy();
    const poolContract = await getVestingPoolContract(vestingLibrary.address);
    const vestingPool = await poolContract.deploy();
    const vestingPoolManagerContract = await getVestingPoolManagerContract();
    const vestingPoolManager = await vestingPoolManagerContract.deploy(
      token.address,
      vestingPool.address,
      airdropManager.address,
    );

    const airdrop = await airdropContract.deploy(
      token.address,
      airdropManager.address,
      redeemDeadline,
      vestingPoolManager.address,
    );
    return {
      token,
      airdrop,
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
    };
  };

  const generateAirdrop = async (
    airdrop: Contract,
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
    airdrop: Contract,
    token: Contract,
    amount: BigNumber = ethers.utils.parseUnits('200000', 18),
    startDate: number = vestingStart,
    executor?: Contract,
  ): Promise<string[]> => {
    const { root, elements } = await generateAirdrop(airdrop, amount, startDate);
    if (executor) {
      const initData = airdrop.interface.encodeFunctionData('initializeRoot', [root]);
      await executor.exec(airdrop.address, 0, initData, 0);
    } else {
      await airdrop.initializeRoot(root);
    }
    await token.transfer(airdrop.address, amount);
    return elements;
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
      .redeem(vesting.curveType, vesting.durationWeeks, vesting.startDate, vesting.amount, vesting.initialUnlock, proof);
    return { vesting, vestingHash };
  };

  describe('claimUnusedTokens', async () => {
    it('should revert if called before redeem deadline', async () => {
      const { airdrop } = await setupTestsWithoutExecutor();
      await expect(airdrop.claimUnusedTokens(user2.address)).to.be.revertedWith(
        'Tokens can still be redeemed',
      );
    });

    it('should revert if no tokens to claim', async () => {
      const { airdrop } = await setupTestsWithoutExecutor();
      await setNextBlockTime(redeemDeadline + 1);
      await expect(airdrop.claimUnusedTokens(user2.address)).to.be.revertedWith(
        'No tokens to claim',
      );
    });

    it('should revert if no tokens to claim after a vesting was created', async () => {
      const { airdrop, token } = await setupTestsWithoutExecutor();
      const amount = ethers.utils.parseUnits('200000', 18);
      const elements = await setupAirdrop(airdrop, token, amount);

      expect(await token.balanceOf(airdrop.address)).to.be.eq(amount);
      await redeemAirdrop(airdrop, elements, user1, amount);
      expect(await token.balanceOf(user2.address)).to.be.eq(0);
      await setNextBlockTime(redeemDeadline + 1);
      await expect(airdrop.claimUnusedTokens(user2.address)).to.be.revertedWith(
        'No tokens to claim',
      );
    });

    it('should be able to claim if no vesting was created', async () => {
      const { airdrop, token } = await setupTestsWithoutExecutor();
      const amount = ethers.utils.parseUnits('200000', 18);
      await token.transfer(airdrop.address, amount);

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
      const { airdrop, token } = await setupTestsWithoutExecutor();
      const leftOver = ethers.utils.parseUnits('100000', 18);
      await token.transfer(airdrop.address, leftOver);
      const amount = ethers.utils.parseUnits('200000', 18);
      const elements = await setupAirdrop(airdrop, token, amount);

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
      const { airdrop, token } = await setupTestsWithoutExecutor();
      const amount = ethers.utils.parseUnits('200000', 18);
      const elements = await setupAirdrop(airdrop, token, amount);

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
