import { expect } from 'chai';
import { deployments, ethers, waffle } from 'hardhat';
import '@nomiclabs/hardhat-ethers';
import { deployTestToken, getVestingLibraryContract, getVestingPoolContract } from '../utils/setup';
import { BigNumber, BigNumberish, Contract } from 'ethers';
import { setNextBlockTime } from '../utils/state';
import { logGas } from '../utils/gas';

const { AddressZero } = ethers.constants;

describe('VestingPool - Manage', async () => {
  const [poolManager, user1, user2] = waffle.provider.getWallets();

  const setupTests = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture(['ShutterToken', 'VestingLibrary']);
    const vestingLibraryContract = await getVestingLibraryContract();
    const vestingLibrary = await vestingLibraryContract.deploy();
    const poolContract = await getVestingPoolContract(vestingLibrary.address);
    const token = await deployTestToken(poolManager.address);
    const pool = await poolContract.deploy(AddressZero);
    return {
      token,
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
    await pool.initialize(token.address, poolManager.address, user2.address);
    const vestingHash = await vestingLibrary.vestingHash(
      user2.address,
      0,
      managed,
      104,
      startTime,
      amount,
      0,
      false,
    );
    await expect(pool.addVesting(0, managed, 104, startTime, amount, 0, false))
      .to.emit(pool, 'AddedVesting')
      .withArgs(vestingHash);
    return { vestingHash };
  };

  describe('pauseVesting', async () => {
    it('should revert if not pool manager', async () => {
      const { pool, token } = await setupTests();
      await pool.initialize(token.address, poolManager.address, user1.address);
      const user2Pool = pool.connect(user2);
      const user1Pool = pool.connect(user1);
      await expect(
        user2Pool.pauseVesting(ethers.utils.keccak256(ethers.utils.toUtf8Bytes('test'))),
      ).to.be.revertedWith('Can only be called by pool manager');

      // also the pool owner cannot pause
      await expect(
        user1Pool.pauseVesting(ethers.utils.keccak256(ethers.utils.toUtf8Bytes('test'))),
      ).to.be.revertedWith('Can only be called by pool manager');
    });

    it('should revert if vesting not found', async () => {
      const { pool, token } = await setupTests();
      await pool.initialize(token.address, poolManager.address, user1.address);
      await expect(
        pool.pauseVesting(ethers.utils.keccak256(ethers.utils.toUtf8Bytes('test'))),
      ).to.be.revertedWith('Vesting not found');
    });

    it('should revert if vesting is not managed', async () => {
      const { pool, token, vestingLibrary } = await setupTests();

      const vestingAmount = ethers.utils.parseUnits('200000', 18);
      const currentTime = (await ethers.provider.getBlock('latest')).timestamp;
      // 1h in the future
      const targetTime = currentTime + 3600;
      const { vestingHash } = await addVesting(
        pool,
        vestingLibrary,
        token,
        vestingAmount,
        targetTime,
        false,
      );

      await expect(pool.pauseVesting(vestingHash)).to.be.revertedWith(
        'Only managed vestings can be paused',
      );
    });

    it('pause vesting that starts in the future', async () => {
      const { pool, token, vestingLibrary } = await setupTests();

      const vestingAmount = ethers.utils.parseUnits('200000', 18);
      const currentTime = (await ethers.provider.getBlock('latest')).timestamp;
      // 1h in the future
      const targetTime = currentTime + 3600;
      const { vestingHash } = await addVesting(
        pool,
        vestingLibrary,
        token,
        vestingAmount,
        targetTime,
      );

      await expect(pool.pauseVesting(vestingHash))
        .to.emit(pool, 'PausedVesting')
        .withArgs(vestingHash);
      const vesting = await pool.vestings(vestingHash);
      // If vesting that starts in the future is paused then the pausing date is the start date
      expect(vesting.pausingDate).to.be.eq(vesting.startDate);
    });

    it('pause vesting that started in the past', async () => {
      const { pool, token, vestingLibrary } = await setupTests();

      const vestingAmount = ethers.utils.parseUnits('200000', 18);
      const currentTime = (await ethers.provider.getBlock('latest')).timestamp;
      // 1h in the future
      const targetTime = currentTime - 3600;
      const { vestingHash } = await addVesting(
        pool,
        vestingLibrary,
        token,
        vestingAmount,
        targetTime,
      );

      await expect(logGas('pause vesting', pool.pauseVesting(vestingHash)))
        .to.emit(pool, 'PausedVesting')
        .withArgs(vestingHash);
      const lastBlockTime = (await ethers.provider.getBlock('latest')).timestamp;
      const vesting = await pool.vestings(vestingHash);
      expect(vesting.pausingDate).to.be.eq(lastBlockTime);
    });

    it('should revert if vesting is paused twice', async () => {
      const { pool, token, vestingLibrary } = await setupTests();

      const vestingAmount = ethers.utils.parseUnits('200000', 18);
      const currentTime = (await ethers.provider.getBlock('latest')).timestamp;
      // 1h in the future
      const targetTime = currentTime + 3600;
      const { vestingHash } = await addVesting(
        pool,
        vestingLibrary,
        token,
        vestingAmount,
        targetTime,
      );

      await expect(pool.pauseVesting(vestingHash))
        .to.emit(pool, 'PausedVesting')
        .withArgs(vestingHash);

      await expect(pool.pauseVesting(vestingHash)).to.be.revertedWith('Vesting already paused');
    });
  });

  describe('unpauseVesting', async () => {
    it('should revert if not pool manager', async () => {
      const { pool } = await setupTests();
      const user2Pool = pool.connect(user2);
      await expect(
        user2Pool.unpauseVesting(ethers.utils.keccak256(ethers.utils.toUtf8Bytes('test'))),
      ).to.be.revertedWith('Can only be called by pool manager');
    });

    it('should revert if vesting not found', async () => {
      const { pool, token } = await setupTests();
      await pool.initialize(token.address, poolManager.address, user1.address);
      await expect(
        pool.unpauseVesting(ethers.utils.keccak256(ethers.utils.toUtf8Bytes('test'))),
      ).to.be.revertedWith('Vesting not found');
    });

    it('should revert if vesting is not paused', async () => {
      const { pool, token, vestingLibrary } = await setupTests();

      const vestingAmount = ethers.utils.parseUnits('200000', 18);
      const currentTime = (await ethers.provider.getBlock('latest')).timestamp;
      // 1h in the future
      const targetTime = currentTime + 3600;
      const { vestingHash } = await addVesting(
        pool,
        vestingLibrary,
        token,
        vestingAmount,
        targetTime,
      );

      await expect(pool.unpauseVesting(vestingHash)).to.be.revertedWith('Vesting is not paused');
    });

    it('unpause vesting that starts in the future', async () => {
      const { pool, token, vestingLibrary } = await setupTests();

      const vestingAmount = ethers.utils.parseUnits('200000', 18);
      const currentTime = (await ethers.provider.getBlock('latest')).timestamp;
      // 1h in the future
      const targetTime = currentTime + 3600;
      const { vestingHash } = await addVesting(
        pool,
        vestingLibrary,
        token,
        vestingAmount,
        targetTime,
      );
      let vesting = await pool.vestings(vestingHash);
      const startingDate = vesting.startDate;
      expect(vesting.pausingDate).to.be.eq(0);

      await pool.pauseVesting(vestingHash);
      vesting = await pool.vestings(vestingHash);
      // If vesting that starts in the future is paused then the pausing date is the start date
      expect(vesting.pausingDate).to.be.eq(vesting.startDate);

      await expect(pool.unpauseVesting(vestingHash))
        .to.emit(pool, 'UnpausedVesting')
        .withArgs(vestingHash);

      vesting = await pool.vestings(vestingHash);
      // If vesting that starts in the future is paused then the pausing date is the start date
      expect(vesting.pausingDate).to.be.eq(0);
      // Starting date should not be adjusted for are in the future
      expect(vesting.startDate).to.be.eq(startingDate);
    });

    it('unpause vesting that starts in the future after it started', async () => {
      const { pool, token, vestingLibrary } = await setupTests();

      const vestingAmount = ethers.utils.parseUnits('200000', 18);
      const currentTime = (await ethers.provider.getBlock('latest')).timestamp;
      // 1h in the future
      const targetTime = currentTime + 3600;
      const { vestingHash } = await addVesting(
        pool,
        vestingLibrary,
        token,
        vestingAmount,
        targetTime,
      );
      let vesting = await pool.vestings(vestingHash);
      expect(vesting.pausingDate).to.be.eq(0);

      await pool.pauseVesting(vestingHash);
      vesting = await pool.vestings(vestingHash);
      // If vesting that starts in the future is paused then the pausing date is the start date
      expect(vesting.pausingDate).to.be.eq(vesting.startDate);

      await setNextBlockTime(targetTime + 400);
      await expect(pool.unpauseVesting(vestingHash))
        .to.emit(pool, 'UnpausedVesting')
        .withArgs(vestingHash);

      vesting = await pool.vestings(vestingHash);
      // If vesting that starts in the future is paused then the pausing date is the start date
      expect(vesting.pausingDate).to.be.eq(0);
      // Starting date should not be adjusted for are in the future
      expect(vesting.startDate).to.be.eq(targetTime + 400);
    });

    it('unpause vesting that started in the past', async () => {
      const { pool, token, vestingLibrary } = await setupTests();

      const vestingAmount = ethers.utils.parseUnits('200000', 18);
      const currentTime = (await ethers.provider.getBlock('latest')).timestamp;
      // 1h in the future
      const targetTime = currentTime - 3600;
      const { vestingHash } = await addVesting(
        pool,
        vestingLibrary,
        token,
        vestingAmount,
        targetTime,
      );
      let vesting = await pool.vestings(vestingHash);
      expect(vesting.pausingDate).to.be.eq(0);

      await setNextBlockTime(targetTime + 4000);
      await pool.pauseVesting(vestingHash);
      vesting = await pool.vestings(vestingHash);
      // If vesting that starts in the future is paused then the pausing date is the start date
      expect(vesting.pausingDate).to.be.eq(targetTime + 4000);

      await setNextBlockTime(targetTime + 14000);
      await expect(logGas('unpause vesting', pool.unpauseVesting(vestingHash)))
        .to.emit(pool, 'UnpausedVesting')
        .withArgs(vestingHash);
      vesting = await pool.vestings(vestingHash);
      // If vesting that starts in the future is paused then the pausing date is the start date
      expect(vesting.pausingDate).to.be.eq(0);
      // Starting date should not be adjusted for are in the future
      expect(vesting.startDate).to.be.eq(targetTime + 10000);
    });
  });

  describe('cancelVesting', async () => {
    it('should revert if not pool manager', async () => {
      const { pool } = await setupTests();
      const user2Pool = pool.connect(user2);
      await expect(
        user2Pool.cancelVesting(ethers.utils.keccak256(ethers.utils.toUtf8Bytes('test'))),
      ).to.be.revertedWith('Can only be called by pool manager');
    });

    it('should revert if vesting not found', async () => {
      const { pool, token } = await setupTests();
      await pool.initialize(token.address, poolManager.address, user1.address);
      await expect(
        pool.cancelVesting(ethers.utils.keccak256(ethers.utils.toUtf8Bytes('test'))),
      ).to.be.revertedWith('Vesting not found');
    });

    it('cancel vesting that starts in the future', async () => {
      const { pool, token, vestingLibrary } = await setupTests();

      const vestingAmount = ethers.utils.parseUnits('200000', 18);
      const currentTime = (await ethers.provider.getBlock('latest')).timestamp;
      // 1h in the future
      const targetTime = currentTime + 3600;
      const { vestingHash } = await addVesting(
        pool,
        vestingLibrary,
        token,
        vestingAmount,
        targetTime,
      );
      let vesting = await pool.vestings(vestingHash);
      expect(vesting.pausingDate).to.be.eq(0);
      expect(vesting.cancelled).to.equal(false);
      expect(await pool.totalTokensInVesting()).to.be.eq(vestingAmount);

      await expect(logGas('cancel vesting', pool.cancelVesting(vestingHash)))
        .to.emit(pool, 'CancelledVesting')
        .withArgs(vestingHash);

      vesting = await pool.vestings(vestingHash);
      // If vesting that starts in the future is cancelled then the pausing date is the start date
      expect(vesting.pausingDate).to.be.eq(vesting.startDate);
      expect(vesting.cancelled).to.equal(true);
      expect(await pool.totalTokensInVesting()).to.be.eq(0);
    });

    it('cancel paused vesting', async () => {
      const { pool, token, vestingLibrary } = await setupTests();

      const vestingAmount = ethers.utils.parseUnits('200000', 18);
      const currentTime = (await ethers.provider.getBlock('latest')).timestamp;
      // 1h in the future
      const targetTime = currentTime + 3600;
      const { vestingHash } = await addVesting(
        pool,
        vestingLibrary,
        token,
        vestingAmount,
        targetTime,
      );
      let vesting = await pool.vestings(vestingHash);
      expect(vesting.pausingDate).to.be.eq(0);
      expect(vesting.cancelled).to.equal(false);
      expect(await pool.totalTokensInVesting()).to.be.eq(vestingAmount);

      await setNextBlockTime(targetTime + 3600);
      await pool.pauseVesting(vestingHash);

      // Check paused vesting state
      vesting = await pool.vestings(vestingHash);
      expect(vesting.pausingDate).to.be.eq(targetTime + 3600);
      expect(vesting.cancelled).to.equal(false);
      expect(await pool.totalTokensInVesting()).to.be.eq(vestingAmount);

      await setNextBlockTime(targetTime + 7200);
      await expect(pool.cancelVesting(vestingHash))
        .to.emit(pool, 'CancelledVesting')
        .withArgs(vestingHash);

      // Check cancelled vesting state
      const expectedAmount = BigNumber.from('11446886446886446886');
      const { vestedAmount } = await pool.calculateVestedAmount(vestingHash);
      expect(vestedAmount).to.be.eq(expectedAmount);

      vesting = await pool.vestings(vestingHash);
      // Pausing date should not be adjusted if vesting was already paused
      expect(vesting.pausingDate).to.be.eq(targetTime + 3600);
      expect(vesting.cancelled).to.equal(true);
      expect(await pool.totalTokensInVesting()).to.be.eq(expectedAmount);
    });

    it('cancel vesting with vested tokens', async () => {
      const { pool, token, vestingLibrary } = await setupTests();

      const vestingAmount = ethers.utils.parseUnits('200000', 18);
      const currentTime = (await ethers.provider.getBlock('latest')).timestamp;
      // 1h in the future
      const targetTime = currentTime + 3600;
      const { vestingHash } = await addVesting(
        pool,
        vestingLibrary,
        token,
        vestingAmount,
        targetTime,
      );
      let vesting = await pool.vestings(vestingHash);
      expect(vesting.pausingDate).to.be.eq(0);
      expect(vesting.cancelled).to.equal(false);
      expect(await pool.totalTokensInVesting()).to.be.eq(vestingAmount);

      await setNextBlockTime(targetTime + 3600);
      await expect(pool.cancelVesting(vestingHash))
        .to.emit(pool, 'CancelledVesting')
        .withArgs(vestingHash);

      const expectedAmount = BigNumber.from('11446886446886446886');
      const { vestedAmount } = await pool.calculateVestedAmount(vestingHash);
      expect(vestedAmount).to.be.eq(expectedAmount);

      vesting = await pool.vestings(vestingHash);
      expect(vesting.pausingDate).to.be.eq(targetTime + 3600);
      expect(vesting.cancelled).to.equal(true);
      expect(await pool.totalTokensInVesting()).to.be.eq(expectedAmount);
    });

    it('should revert if vesting is not managed', async () => {
      const { pool, token, vestingLibrary } = await setupTests();

      const vestingAmount = ethers.utils.parseUnits('200000', 18);
      const currentTime = (await ethers.provider.getBlock('latest')).timestamp;
      // 1h in the future
      const targetTime = currentTime + 3600;
      const { vestingHash } = await addVesting(
        pool,
        vestingLibrary,
        token,
        vestingAmount,
        targetTime,
        false,
      );

      await expect(pool.cancelVesting(vestingHash)).to.be.revertedWith(
        'Only managed vestings can be cancelled',
      );
    });

    it('should revert if vesting is cancelled twice', async () => {
      const { pool, token, vestingLibrary } = await setupTests();

      const vestingAmount = ethers.utils.parseUnits('200000', 18);
      const currentTime = (await ethers.provider.getBlock('latest')).timestamp;
      // 1h in the future
      const targetTime = currentTime + 3600;
      const { vestingHash } = await addVesting(
        pool,
        vestingLibrary,
        token,
        vestingAmount,
        targetTime,
      );

      await pool.cancelVesting(vestingHash);

      await expect(pool.cancelVesting(vestingHash)).to.be.revertedWith('Vesting already cancelled');
    });

    it('should revert if cancelled vesting is unpaused', async () => {
      const { pool, token, vestingLibrary } = await setupTests();

      const vestingAmount = ethers.utils.parseUnits('200000', 18);
      const currentTime = (await ethers.provider.getBlock('latest')).timestamp;
      // 1h in the future
      const targetTime = currentTime + 3600;
      const { vestingHash } = await addVesting(
        pool,
        vestingLibrary,
        token,
        vestingAmount,
        targetTime,
      );
      let vesting = await pool.vestings(vestingHash);
      expect(vesting.pausingDate).to.be.eq(0);
      expect(vesting.cancelled).to.equal(false);
      expect(await pool.totalTokensInVesting()).to.be.eq(vestingAmount);

      await setNextBlockTime(targetTime + 3600);
      await pool.cancelVesting(vestingHash);

      vesting = await pool.vestings(vestingHash);
      expect(vesting.pausingDate).to.be.eq(targetTime + 3600);
      expect(vesting.cancelled).to.equal(true);

      await expect(pool.unpauseVesting(vestingHash)).to.be.revertedWith(
        'Vesting has been cancelled and cannot be unpaused',
      );
    });
  });
});
