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
import { BigNumber, Contract } from 'ethers';
import { generateRoot, generateProof } from '../../src/utils/proof';
import { setNextBlockTime } from '../utils/state';

describe('Airdrop - Redeem', async () => {
  const vestingStart = new Date().getTime();
  const redeemDeadline = new Date().getTime() + 60 * 60 * 1000;
  const users = waffle.provider.getWallets();
  const [airdropManager, user1, user2] = users;

  const setupTests = deployments.createFixture(async ({ deployments }) => {
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

  const createVesting = (account: string, amount: BigNumber): Vesting => {
    return {
      owner: account,
      curveType: 0,
      managed: false,
      durationWeeks: 208,
      startDate: vestingStart,
      amount,
      initialUnlock: 0,
    };
  };

  const generateAirdrop = async (
    amount: BigNumber,
  ): Promise<{
    root: string;
    elements: string[];
  }> => {
    const elements = users
      .map(u => u.address)
      .map((account: string) => {
        return createVesting(account, amount);
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

  describe('redeem', async () => {
    it('should revert if root not set', async () => {
      const { airdrop, token } = await setupTests();
      const amount = ethers.utils.parseUnits('200000', 18);
      const vesting = createVesting(user1.address, amount);
      await expect(
        airdrop.redeem(
          vesting.curveType,
          vesting.durationWeeks,
          vesting.startDate,
          vesting.amount,
          [],
        ),
      ).to.be.revertedWith('State root not initialized');
    });

    it('should revert with invalid proof', async () => {
      const { airdrop, token } = await setupTests();
      const amount = ethers.utils.parseUnits('200000', 18);
      const { root, elements } = await generateAirdrop(amount);
      await airdrop.initializeRoot(root);
      await token.transfer(airdrop.address, amount);
      const vesting = createVesting(user1.address, amount);
      const vestingHash = calculateVestingHash(vesting);
      const proof = generateProof(elements, vestingHash);
      proof.pop();
      await expect(
        airdrop.redeem(
          vesting.curveType,
          vesting.durationWeeks,
          vesting.startDate,
          vesting.amount,
          proof,
        ),
      ).to.be.revertedWith('Invalid merkle proof');
    });

    it('should revert if not redeemed by vesting owner', async () => {
      const { airdrop, token } = await setupTests();
      const amount = ethers.utils.parseUnits('200000', 18);
      const { root, elements } = await generateAirdrop(amount);
      await airdrop.initializeRoot(root);
      await token.transfer(airdrop.address, amount);
      const vesting = createVesting(user2.address, amount);
      const vestingHash = calculateVestingHash(vesting);
      const proof = generateProof(elements, vestingHash);
      proof.pop();
      await expect(
        airdrop.redeem(
          vesting.curveType,
          vesting.durationWeeks,
          vesting.startDate,
          vesting.amount,
          proof,
        ),
      ).to.be.revertedWith('Invalid merkle proof');
    });

    it('should revert if redeemed twice', async () => {
      const { airdrop, token } = await setupTests();
      const amount = ethers.utils.parseUnits('200000', 18);
      const { root, elements } = await generateAirdrop(amount);
      await airdrop.initializeRoot(root);
      await token.transfer(airdrop.address, amount.mul(elements.length));
      const vesting = createVesting(user1.address, amount);
      const vestingHash = calculateVestingHash(vesting);
      const proof = generateProof(elements, vestingHash);
      await airdrop
        .connect(user1)
        .redeem(vesting.curveType, vesting.durationWeeks, vesting.startDate, vesting.amount, proof);
      await expect(
        airdrop
          .connect(user1)
          .redeem(
            vesting.curveType,
            vesting.durationWeeks,
            vesting.startDate,
            vesting.amount,
            proof,
          ),
      ).to.be.revertedWith('Vesting id already used');
    });

    it('should revert if redeemed after deadline', async () => {
      const { airdrop, token } = await setupTests();
      const amount = ethers.utils.parseUnits('200000', 18);
      const { root, elements } = await generateAirdrop(amount);
      await airdrop.initializeRoot(root);
      await token.transfer(airdrop.address, amount);
      const vesting = createVesting(user1.address, amount);
      const vestingHash = calculateVestingHash(vesting);
      const proof = generateProof(elements, vestingHash);
      await setNextBlockTime(redeemDeadline + 1);
      await expect(
        airdrop.redeem(
          vesting.curveType,
          vesting.durationWeeks,
          vesting.startDate,
          vesting.amount,
          proof,
        ),
      ).to.be.revertedWith('Deadline to redeem vesting has been exceeded');
    });

    it('will add vesting', async () => {
      const { airdrop, token } = await setupTests();
      const amount = ethers.utils.parseUnits('200000', 18);
      const { root, elements } = await generateAirdrop(amount);
      await airdrop.initializeRoot(root);
      await token.transfer(airdrop.address, amount);
      const vesting = createVesting(user1.address, amount);
      const vestingHash = calculateVestingHash(vesting);
      const proof = generateProof(elements, vestingHash);
      await expect(
        airdrop
          .connect(user1)
          .redeem(
            vesting.curveType,
            vesting.durationWeeks,
            vesting.startDate,
            vesting.amount,
            proof,
          ),
      )
        .to.emit(airdrop, 'RedeemedVesting')
        .withArgs(vestingHash, user1.address);
    });

    it('can redeem all vestings', async () => {
      const { airdrop, token } = await setupTests();
      const amount = ethers.utils.parseUnits('200000', 18);
      const { root, elements } = await generateAirdrop(amount);
      await airdrop.initializeRoot(root);
      await token.transfer(airdrop.address, amount.mul(users.length));
      for (const user of users) {
        const vesting = createVesting(user.address, amount);
        const vestingHash = calculateVestingHash(vesting);
        const proof = generateProof(elements, vestingHash);
        await expect(
          airdrop
            .connect(user)
            .redeem(
              vesting.curveType,
              vesting.durationWeeks,
              vesting.startDate,
              vesting.amount,
              proof,
            ),
        )
          .to.emit(airdrop, 'RedeemedVesting')
          .withArgs(vestingHash, user.address);
      }
      expect(await token.balanceOf(airdrop.address)).to.be.eq(0);
    });
  });
});
