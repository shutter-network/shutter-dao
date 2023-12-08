import { expect } from 'chai';
import { deployments, ethers, waffle } from 'hardhat';
import '@nomiclabs/hardhat-ethers';
import {
  deployTestToken,
  getExecutor,
  getMock,
  getSptConversionContract,
  getTestTokenContract,
  getUserVestingProxy,
  getVestingLibraryContract,
  getVestingPoolContract,
  getVestingPoolManagerContract,
} from '../utils/setup';
import { Vesting } from '../../src/utils/types';
import { calculateVestingHash } from '../../src/utils/hash';
import { BigNumber } from 'ethers';
import { generateRoot, generateProof } from '../../src/utils/proof';
import { setNextBlockTime } from '../utils/state';

describe('SptConversion - Redeem', async () => {
  const vestingStart = new Date().getTime();
  const redeemDeadline = new Date().getTime() + 60 * 60 * 1000;
  const users = waffle.provider.getWallets();
  const [airdropManager, user1, user2] = users;
  const amount = ethers.utils.parseUnits('200000', 18);
  const initialUnlockAmount = ethers.utils.parseUnits('100000', 18);

  const setupTests = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture(['VestingLibrary', 'VestingPool']);
    const airdropContract = await getSptConversionContract();
    const token = await deployTestToken(airdropManager.address);
    const sptToken = await deployTestToken(airdropManager.address);
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
    let airdropVestings = await generateAirdrop(amount);
    const airdrop = await airdropContract.deploy(
      token.address,
      airdropManager.address,
      redeemDeadline,
      vestingPoolManager.address,
      airdropVestings.root,
      sptToken.address,
    );

    airdropVestings = await generateAirdrop(amount, initialUnlockAmount);
    const airdropWithInitialUnlockVestings = await airdropContract.deploy(
      token.address,
      airdropManager.address,
      redeemDeadline,
      vestingPoolManager.address,
      airdropVestings.root,
      sptToken.address,
    );

    return {
      token,
      sptToken,
      airdrop,
      airdropWithInitialUnlockVestings,
      vestingPoolManager,
    };
  });

  const setupTestsWithMock = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture(['VestingLibrary', 'VestingPool']);
    const executor = await getExecutor();
    const airdropContract = await getSptConversionContract();
    const vestingLibraryContract = await getVestingLibraryContract();
    const vestingLibrary = await vestingLibraryContract.deploy();
    const poolContract = await getVestingPoolContract(vestingLibrary.address);
    const vestingPoolManagerContract = await getVestingPoolManagerContract();
    const tokenContract = await getTestTokenContract();
    const sptToken = await deployTestToken(airdropManager.address);
    const mock = await getMock();
    const token = tokenContract.attach(mock.address);
    const pool = await poolContract.deploy();

    const vestingPoolManager = await vestingPoolManagerContract.deploy(
      token.address,
      pool.address,
      executor.address,
    );

    let airdropVestings = await generateAirdrop(amount);
    const airdrop = await airdropContract.deploy(
      token.address,
      executor.address,
      redeemDeadline,
      vestingPoolManager.address,
      airdropVestings.root,
      sptToken.address,
    );

    airdropVestings = await generateAirdrop(amount, initialUnlockAmount);
    const airdropWithInitialUnlockVestings = await airdropContract.deploy(
      token.address,
      executor.address,
      redeemDeadline,
      vestingPoolManager.address,
      airdropVestings.root,
      sptToken.address,
    );

    return {
      token,
      sptToken,
      pool,
      vestingPoolManager,
      vestingLibrary,
      executor,
      mock,
      airdrop,
      airdropWithInitialUnlockVestings,
    };
  });

  const createVesting = (
    account: string,
    amount: BigNumber,
    initialUnlock: BigNumber = BigNumber.from(0),
  ): Vesting => {
    return {
      owner: account,
      curveType: 0,
      managed: false,
      durationWeeks: 208,
      startDate: vestingStart,
      amount,
      initialUnlock,
    };
  };

  const generateAirdrop = async (
    amount: BigNumber,
    initialUnlock: BigNumber = BigNumber.from(0),
  ): Promise<{
    root: string;
    elements: string[];
  }> => {
    const elements = users
      .map(u => u.address)
      .map((account: string) => {
        return createVesting(account, amount, initialUnlock);
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
    it('should revert with invalid proof', async () => {
      const { airdrop, token, sptToken } = await setupTests();
      const { elements } = await generateAirdrop(amount);
      // give the necessary allowance on the sptToken
      await sptToken.approve(airdrop.address, amount);
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
          vesting.initialUnlock,
          proof,
        ),
      ).to.be.revertedWith('Invalid merkle proof');
    });

    it('should revert if not redeemed by vesting owner', async () => {
      const { airdrop, token, sptToken } = await setupTests();
      const { elements } = await generateAirdrop(amount);
      await sptToken.approve(airdrop.address, amount);
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
          vesting.initialUnlock,
          proof,
        ),
      ).to.be.revertedWith('Invalid merkle proof');
    });

    it('should revert if redeemed twice', async () => {
      const { airdrop, token, sptToken } = await setupTests();
      const { elements } = await generateAirdrop(amount);
      await sptToken.transfer(user1.address, amount.mul(elements.length));
      await sptToken.connect(user1).approve(airdrop.address, amount.mul(elements.length));
      await token.transfer(airdrop.address, amount.mul(elements.length));
      const vesting = createVesting(user1.address, amount);
      const vestingHash = calculateVestingHash(vesting);
      const proof = generateProof(elements, vestingHash);
      await airdrop
        .connect(user1)
        .redeem(
          vesting.curveType,
          vesting.durationWeeks,
          vesting.startDate,
          vesting.amount,
          vesting.initialUnlock,
          proof,
        );
      await expect(
        airdrop
          .connect(user1)
          .redeem(
            vesting.curveType,
            vesting.durationWeeks,
            vesting.startDate,
            vesting.amount,
            vesting.initialUnlock,
            proof,
          ),
      ).to.be.revertedWith('Vesting id already used');
    });

    it('should revert if redeemed after deadline', async () => {
      const { airdrop, token, sptToken } = await setupTests();
      const { elements } = await generateAirdrop(amount);
      await sptToken.approve(airdrop.address, amount);
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
          vesting.initialUnlock,
          proof,
        ),
      ).to.be.revertedWith('Deadline to redeem vesting has been exceeded');
    });

    it('should be able to redeem vesting', async () => {
      const { airdrop, token, sptToken } = await setupTests();
      const { elements } = await generateAirdrop(amount);
      await sptToken.transfer(user1.address, amount);
      await sptToken.connect(user1).approve(airdrop.address, amount);
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
            vesting.initialUnlock,
            proof,
          ),
      )
        .to.emit(airdrop, 'RedeemedVesting')
        .withArgs(vestingHash, user1.address);
    });

    it.only('should not be able to redeem if not sending the SPT tokens', async () => {
      const { airdrop, token, sptToken } = await setupTests();
      const { elements } = await generateAirdrop(amount);
      // user1 has no tokens, but grants allowance
      await sptToken.connect(user1).approve(airdrop.address, amount);
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
            vesting.initialUnlock,
            proof,
          ),
      ).to.revertedWith('ERC20InsufficientBalance');
    });

    it('can redeem all vestings', async () => {
      const { airdrop, token, sptToken } = await setupTests();
      const { elements } = await generateAirdrop(amount);

      await token.transfer(airdrop.address, amount.mul(users.length));
      for (const user of users) {
        await sptToken.transfer(user.address, amount);
        await sptToken.connect(user).approve(airdrop.address, amount);
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
              vesting.initialUnlock,
              proof,
            ),
        )
          .to.emit(airdrop, 'RedeemedVesting')
          .withArgs(vestingHash, user.address);
      }
      expect(await token.balanceOf(airdrop.address)).to.be.eq(0);
    });

    it('should be able to withdraw initialUnlock', async () => {
      const { airdropWithInitialUnlockVestings, token, vestingPoolManager, sptToken } =
        await setupTests();
      const airdrop = airdropWithInitialUnlockVestings;
      const { elements } = await generateAirdrop(amount, initialUnlockAmount);
      await sptToken.transfer(user1.address, amount);
      await sptToken.connect(user1).approve(airdrop.address, amount);
      await token.transfer(airdrop.address, amount);
      const vesting = createVesting(user1.address, amount, initialUnlockAmount);
      const vestingHash = calculateVestingHash(vesting);
      const proof = generateProof(elements, vestingHash);

      expect(await token.balanceOf(user1.address)).to.be.eq(0);
      await expect(
        airdrop
          .connect(user1)
          .redeem(
            vesting.curveType,
            vesting.durationWeeks,
            vesting.startDate,
            vesting.amount,
            vesting.initialUnlock,
            proof,
          ),
      )
        .to.emit(airdrop, 'RedeemedVesting')
        .withArgs(vestingHash, user1.address);

      expect(await token.balanceOf(user1.address)).to.be.eq(0);
      // get user's proxy
      const proxy = await getUserVestingProxy(vestingPoolManager, user1.address);

      // move chain to vesting startdate
      await setNextBlockTime(vesting.startDate);

      // claim
      await expect(
        proxy.connect(user1).claimVestedTokens(vestingHash, user1.address, initialUnlockAmount),
      ).to.emit(proxy, 'ClaimedVesting');

      expect(await token.balanceOf(user1.address)).to.be.eq(initialUnlockAmount);
    });

    it('should be able to redeem even if token is paused', async () => {
      const { airdrop, token, mock, executor, vestingPoolManager, sptToken } =
        await setupTestsWithMock();
      await executor.enableModule(vestingPoolManager.address);

      const amount = ethers.utils.parseUnits('200000', 18);
      await sptToken.transfer(user1.address, amount);
      await sptToken.connect(user1).approve(airdrop.address, amount);
      await mock.givenMethodReturnUint(token.interface.getSighash('balanceOf'), amount);
      await mock.givenMethodReturnBool(token.interface.getSighash('paused'), true);
      const { elements } = await generateAirdrop(amount);
      await token.transfer(airdrop.address, amount);

      const vesting = createVesting(user1.address, amount);
      const vestingHash = calculateVestingHash(vesting);
      const proof = generateProof(elements, vestingHash);

      await token.pause();
      await token.transferOwnership(executor.address);

      await expect(
        airdrop
          .connect(user1)
          .redeem(
            vesting.curveType,
            vesting.durationWeeks,
            vesting.startDate,
            vesting.amount,
            vesting.initialUnlock,
            proof,
          ),
      )
        .to.emit(airdrop, 'RedeemedVesting')
        .withArgs(vestingHash, user1.address);

      const proxy = await getUserVestingProxy(vestingPoolManager, user1.address);

      expect(await token.balanceOf(proxy.address)).to.be.eq(amount);
    });
  });
});