import { expect } from 'chai';
import { deployments, ethers, waffle } from 'hardhat';
import '@nomiclabs/hardhat-ethers';
import {
  deployTestToken,
  getVestingLibraryContract,
  getVestingPoolContract,
} from '../utils/setup';
import { BigNumber, BigNumberish, Contract } from 'ethers';
import { setNextBlockTime } from '../utils/state';

describe('VestingPool - Claim with SPT', async () => {
  const MAX_UINT128 = BigNumber.from('0xffffffffffffffffffffffffffffffff');
  const WEEK_IN_SECONDS = 7 * 24 * 60 * 60;
  const [poolManager, user1] = waffle.provider.getWallets();

  const setupTests = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture(['ShutterToken', 'VestingLibrary']);
    const vestingLibraryContract = await getVestingLibraryContract();
    const vestingLibrary = await vestingLibraryContract.deploy();
    const poolContract = await getVestingPoolContract(vestingLibrary.address);
    const token = await deployTestToken(poolManager.address);
    const sptToken = await deployTestToken(poolManager.address);
    const pool = await poolContract.deploy(sptToken.address);
    return {
      token,
      sptToken,
      pool,
      vestingLibrary,
    };
  });

  const addVesting = async (
    pool: Contract,
    vestingLibrary: Contract,
    token: Contract,
    amount: BigNumberish,
    startTime: number,
    managed: boolean = true,
  ) => {
    await token.transfer(pool.address, amount);
    const vestingHash = await vestingLibrary.vestingHash(
      user1.address,
      0,
      managed,
      1,
      startTime,
      amount,
      0,
      true
    );
    await expect(pool.addVesting(0, managed, 1, startTime, amount, 0, true))
      .to.emit(pool, 'AddedVesting')
      .withArgs(vestingHash);
    return { vestingHash };
  };

  describe('claimVestedTokens', async () => {
    it('should revert if user has no SPT', async () => {
      const { pool, token, sptToken, vestingLibrary } = await setupTests();
      pool.initialize(token.address, poolManager.address, user1.address);
      const vestingAmount = ethers.utils.parseUnits('1000', 18);
      const currentTime = (await ethers.provider.getBlock('latest')).timestamp;

      const targetTime = currentTime-1;
      const { vestingHash } = await addVesting(
        pool,
        vestingLibrary,
        token,
        vestingAmount,
        targetTime,
      );

      const user2Pool = pool.connect(user1);
      await expect(
        user2Pool.claimVestedTokens(vestingHash, user1.address, MAX_UINT128),
      ).to.be.revertedWith('ERC20InsufficientAllowance');

      await sptToken.connect(user1).approve(pool.address, vestingAmount);
      await expect(
        user2Pool.claimVestedTokens(vestingHash, user1.address, MAX_UINT128),
      ).to.be.revertedWith('ERC20InsufficientBalance');
    });

    it('should be able to claim complete vesting at once if user has enough SPT', async () => {
      const { pool, token, sptToken, vestingLibrary } = await setupTests();
      pool.initialize(token.address, poolManager.address, user1.address);
      const vestingAmount = ethers.utils.parseUnits('1000', 18);
      const currentTime = (await ethers.provider.getBlock('latest')).timestamp;

      const targetTime = currentTime;
      const { vestingHash } = await addVesting(
        pool,
        vestingLibrary,
        token,
        vestingAmount,
        targetTime,
      );

      const userPool = pool.connect(user1);

      await sptToken.transfer(user1.address, vestingAmount);
      await sptToken.connect(user1).approve(pool.address, vestingAmount);

      await setNextBlockTime(targetTime + WEEK_IN_SECONDS, true);

      // claim everything
      await expect(
        userPool.claimVestedTokens(vestingHash, user1.address, ethers.utils.parseUnits('1000', 18)),
      ).to.emit(userPool, 'ClaimedVesting')
    });

    it('should be able to claim partials if user has enough SPT', async () => {
      const { pool, token, sptToken, vestingLibrary } = await setupTests();
      pool.initialize(token.address, poolManager.address, user1.address);
      const vestingAmount = ethers.utils.parseUnits('1000', 18);
      const currentTime = (await ethers.provider.getBlock('latest')).timestamp;

      const targetTime = currentTime;
      const { vestingHash } = await addVesting(
        pool,
        vestingLibrary,
        token,
        vestingAmount,
        targetTime,
      );

      const userPool = pool.connect(user1);

      await sptToken.transfer(user1.address, vestingAmount);
      await sptToken.connect(user1).approve(pool.address, vestingAmount);

      await setNextBlockTime(targetTime + WEEK_IN_SECONDS, true);

      // partial claim 1
      await expect(
        userPool.claimVestedTokens(vestingHash, user1.address, ethers.utils.parseUnits('500', 18)),
      ).to.emit(userPool, 'ClaimedVesting')

      // partial claim 1
      await expect(
        userPool.claimVestedTokens(vestingHash, user1.address, ethers.utils.parseUnits('500', 18)),
      ).to.emit(userPool, 'ClaimedVesting')

      // should exceed as vesting was claimed completely
      await expect(
        userPool.claimVestedTokens(vestingHash, user1.address, ethers.utils.parseUnits('500', 18)),
      ).to.be.revertedWith('Trying to claim too many tokens')
    });

    it('should only be able to claim up to the amount of available SPT', async () => {
      const { pool, token, sptToken, vestingLibrary } = await setupTests();
      pool.initialize(token.address, poolManager.address, user1.address);
      const vestingAmount = ethers.utils.parseUnits('1000', 18);
      const currentTime = (await ethers.provider.getBlock('latest')).timestamp;

      const targetTime = currentTime;
      const { vestingHash } = await addVesting(
        pool,
        vestingLibrary,
        token,
        vestingAmount,
        targetTime,
      );

      const userPool = pool.connect(user1);

      await sptToken.transfer(user1.address,  ethers.utils.parseUnits('500', 18));
      await sptToken.connect(user1).approve(pool.address, vestingAmount);

      await setNextBlockTime(targetTime + WEEK_IN_SECONDS, true);

      // claim too much
      await expect(
        userPool.claimVestedTokens(vestingHash, user1.address, ethers.utils.parseUnits('1000', 18)),
      ).to.be.revertedWith('ERC20InsufficientBalance')


      // claim as much as user has
      await expect(
        userPool.claimVestedTokens(vestingHash, user1.address, ethers.utils.parseUnits('500', 18)),
      ).to.emit(userPool, 'ClaimedVesting')

      // try to claim a bit more again
      await expect(
        userPool.claimVestedTokens(vestingHash, user1.address, ethers.utils.parseUnits('1', 18)),
      ).to.be.revertedWith('ERC20InsufficientBalance')
    });
  });
});
