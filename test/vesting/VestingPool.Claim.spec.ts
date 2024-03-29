import { expect } from 'chai';
import { deployments, ethers, waffle } from 'hardhat';
import '@nomiclabs/hardhat-ethers';
import {
  deployTestToken,
  getMock,
  getTestTokenContract,
  getVestingLibraryContract,
  getVestingPoolContract,
} from '../utils/setup';
import { BigNumber, BigNumberish, Contract } from 'ethers';
import { setNextBlockTime } from '../utils/state';
import { logGas } from '../utils/gas';

const { AddressZero } = ethers.constants;

describe('VestingPool - Claim', async () => {
  const MAX_UINT128 = BigNumber.from('0xffffffffffffffffffffffffffffffff');
  const WEEK_IN_SECONDS = 7 * 24 * 60 * 60;
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
    const vestingHash = await vestingLibrary.vestingHash(
      user1.address,
      0,
      managed,
      2,
      startTime,
      amount,
      0,
      false
    );
    await expect(pool.addVesting(0, managed, 2, startTime, amount, 0, false))
      .to.emit(pool, 'AddedVesting')
      .withArgs(vestingHash);
    return { vestingHash };
  };

  describe('claimVestedTokens', async () => {
    it('should revert if not vesting owner', async () => {
      const { pool, token, vestingLibrary } = await setupTests();
      pool.initialize(token.address, poolManager.address, user1.address);
      const vestingAmount = ethers.utils.parseUnits('1000', 18);
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

      const user2Pool = pool.connect(user2);
      await expect(
        user2Pool.claimVestedTokens(vestingHash, user1.address, MAX_UINT128),
      ).to.be.revertedWith('Can only be claimed by vesting owner');
    });

    it('should revert if beneficiary is 0-address', async () => {
      const { pool, token, vestingLibrary } = await setupTests();
      pool.initialize(token.address, poolManager.address, user1.address);
      const vestingAmount = ethers.utils.parseUnits('1000', 18);
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
      const user1pool = pool.connect(user1);
      await expect(
        user1pool.claimVestedTokens(vestingHash, ethers.constants.AddressZero, MAX_UINT128),
      ).to.be.revertedWith('Cannot claim to 0-address');
    });

    it('should revert if claiming too many tokens', async () => {
      const { pool, token, vestingLibrary } = await setupTests();
      pool.initialize(token.address, poolManager.address, user1.address);
      const user1pool = pool.connect(user1);
      const vestingAmount = ethers.utils.parseUnits('1000', 18);
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

      await setNextBlockTime(currentTime + 7200);
      await expect(
        user1pool.claimVestedTokens(vestingHash, user1.address, vestingAmount),
      ).to.be.revertedWith('Trying to claim too many tokens');
    });

    it('should revert if token transfer fails', async () => {
      const mock = await getMock();
      const vestingLibraryContract = await getVestingLibraryContract();
      const vestingLibrary = await vestingLibraryContract.deploy();
      const tokenContract = await getTestTokenContract();
      const token = tokenContract.attach(mock.address);
      const poolContract = await getVestingPoolContract(vestingLibrary.address);
      const pool = await poolContract.deploy(AddressZero);
      pool.initialize(token.address, poolManager.address, user1.address);
      const user1pool = pool.connect(user1);
      const vestingAmount = ethers.utils.parseUnits('1000', 18);

      await mock.givenMethodReturnUint(
        tokenContract.interface.getSighash('balanceOf'),
        vestingAmount,
      );
      await mock.givenMethodReturnBool(tokenContract.interface.getSighash('transfer'), true);

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

      await mock.givenMethodReturnBool(tokenContract.interface.getSighash('transfer'), false);
      await setNextBlockTime(targetTime + 7200);
      await expect(
        user1pool.claimVestedTokens(vestingHash, user1.address, MAX_UINT128),
      ).to.be.revertedWith('Token transfer failed');
    });

    it('should revert if token transfer reverts', async () => {
      const mock = await getMock();
      const vestingLibraryContract = await getVestingLibraryContract();
      const vestingLibrary = await vestingLibraryContract.deploy();
      const tokenContract = await getTestTokenContract();
      const token = tokenContract.attach(mock.address);
      const poolContract = await getVestingPoolContract(vestingLibrary.address);
      const pool = await poolContract.deploy(AddressZero);
      pool.initialize(token.address, poolManager.address, user1.address);
      const user1pool = pool.connect(user1);
      const vestingAmount = ethers.utils.parseUnits('1000', 18);

      await mock.givenMethodReturnUint(
        tokenContract.interface.getSighash('balanceOf'),
        vestingAmount,
      );
      await mock.givenMethodReturnBool(tokenContract.interface.getSighash('transfer'), true);

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

      await mock.givenMethodRevertWithMessage(
        tokenContract.interface.getSighash('transfer'),
        'Token: Transfer failed!',
      );
      await setNextBlockTime(targetTime + 7200);
      await expect(
        user1pool.claimVestedTokens(vestingHash, user1.address, MAX_UINT128),
      ).to.be.revertedWith('Token: Transfer failed!');
    });

    it('should revert if  vesting is not active yet', async () => {
      const { pool, token, vestingLibrary } = await setupTests();
      pool.initialize(token.address, poolManager.address, user1.address);
      const user1pool = pool.connect(user1);
      const vestingAmount = ethers.utils.parseUnits('1000', 18);
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

      await expect(
        user1pool.claimVestedTokens(vestingHash, user1.address, MAX_UINT128),
      ).to.be.revertedWith('Vesting not active yet');
    });

    it('can claim available tokens while vesting is running', async () => {
      const { pool, token, vestingLibrary } = await setupTests();
      pool.initialize(token.address, poolManager.address, user1.address);
      const user1pool = pool.connect(user1);
      const vestingAmount = ethers.utils.parseUnits('1000', 18);
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
      expect(vesting.amount).to.be.eq(vestingAmount);
      expect(vesting.amountClaimed).to.be.eq(0);

      await setNextBlockTime(targetTime + WEEK_IN_SECONDS);
      const claimAmount = vestingAmount.div(2);
      await expect(
        logGas(
          'claim vesting',
          user1pool.claimVestedTokens(vestingHash, user1.address, claimAmount),
        ),
      )
        .to.emit(pool, 'ClaimedVesting')
        .withArgs(vestingHash, user1.address)
        .and.to.emit(token, 'Transfer')
        .withArgs(pool.address, user1.address, claimAmount);
      vesting = await pool.vestings(vestingHash);
      expect(vesting.amount).to.be.eq(vestingAmount);
      expect(vesting.amountClaimed).to.be.eq(claimAmount);
      const { vestedAmount, claimedAmount } = await pool.calculateVestedAmount(vestingHash);
      expect(vestedAmount).to.be.eq(claimAmount);
      expect(claimedAmount).to.be.eq(claimAmount);
    });

    it('can claim all tokens after vesting is completed', async () => {
      const { pool, token, vestingLibrary } = await setupTests();
      pool.initialize(token.address, poolManager.address, user1.address);
      const user1pool = pool.connect(user1);
      const vestingAmount = ethers.utils.parseUnits('1000', 18);
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
      expect(vesting.amount).to.be.eq(vestingAmount);
      expect(vesting.amountClaimed).to.be.eq(0);

      await setNextBlockTime(targetTime + 3 * WEEK_IN_SECONDS);
      await expect(user1pool.claimVestedTokens(vestingHash, user1.address, MAX_UINT128))
        .to.emit(pool, 'ClaimedVesting')
        .withArgs(vestingHash, user1.address)
        .and.to.emit(token, 'Transfer')
        .withArgs(pool.address, user1.address, vestingAmount);
      vesting = await pool.vestings(vestingHash);
      expect(vesting.amount).to.be.eq(vestingAmount);
      expect(vesting.amountClaimed).to.be.eq(vestingAmount);
      const { vestedAmount, claimedAmount } = await pool.calculateVestedAmount(vestingHash);
      expect(vestedAmount).to.be.eq(vestingAmount);
      expect(claimedAmount).to.be.eq(vestingAmount);
    });

    it('can claim available tokens to different account', async () => {
      const { pool, token, vestingLibrary } = await setupTests();
      pool.initialize(token.address, poolManager.address, user1.address);
      const user1pool = pool.connect(user1);
      const vestingAmount = ethers.utils.parseUnits('1000', 18);
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
      expect(vesting.amount).to.be.eq(vestingAmount);
      expect(vesting.amountClaimed).to.be.eq(0);

      await setNextBlockTime(targetTime + WEEK_IN_SECONDS);
      const claimAmount = vestingAmount.div(2);
      await expect(user1pool.claimVestedTokens(vestingHash, user2.address, claimAmount))
        .to.emit(pool, 'ClaimedVesting')
        .withArgs(vestingHash, user2.address)
        .and.to.emit(token, 'Transfer')
        .withArgs(pool.address, user2.address, claimAmount);
      vesting = await pool.vestings(vestingHash);
      expect(vesting.amount).to.be.eq(vestingAmount);
      expect(vesting.amountClaimed).to.be.eq(claimAmount);
      const { vestedAmount, claimedAmount } = await pool.calculateVestedAmount(vestingHash);
      expect(vestedAmount).to.be.eq(claimAmount);
      expect(claimedAmount).to.be.eq(claimAmount);
    });

    it('can claim tokens when vesting is paused', async () => {
      const { pool, token, vestingLibrary } = await setupTests();
      pool.initialize(token.address, poolManager.address, user1.address);
      const user1pool = pool.connect(user1);
      const vestingAmount = ethers.utils.parseUnits('1000', 18);
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
      const vesting = await pool.vestings(vestingHash);
      expect(vesting.amount).to.be.eq(vestingAmount);
      expect(vesting.amountClaimed).to.be.eq(0);

      // Pause vesting after half of the amount is vested
      await setNextBlockTime(targetTime + WEEK_IN_SECONDS);
      await pool.pauseVesting(vestingHash);
      let amounts = await pool.calculateVestedAmount(vestingHash);
      expect(amounts.vestedAmount).to.be.eq(vestingAmount.div(2));
      expect(amounts.claimedAmount).to.be.eq(0);

      // Claim available tokens
      await setNextBlockTime(targetTime + 2 * WEEK_IN_SECONDS);
      await expect(user1pool.claimVestedTokens(vestingHash, user1.address, MAX_UINT128))
        .to.emit(pool, 'ClaimedVesting')
        .withArgs(vestingHash, user1.address)
        .and.to.emit(token, 'Transfer')
        .withArgs(pool.address, user1.address, vestingAmount.div(2));

      // Check that no additional tokens have been vested
      amounts = await pool.calculateVestedAmount(vestingHash);
      expect(amounts.vestedAmount).to.be.eq(vestingAmount.div(2));
      expect(amounts.claimedAmount).to.be.eq(vestingAmount.div(2));

      // Unpause the vesting after 2 weeks have elapsed
      await setNextBlockTime(targetTime + 3 * WEEK_IN_SECONDS);
      await pool.unpauseVesting(vestingHash);
      // Check that no additional tokens have been vested during pause
      amounts = await pool.calculateVestedAmount(vestingHash);
      expect(amounts.vestedAmount).to.be.eq(vestingAmount.div(2));
      expect(amounts.claimedAmount).to.be.eq(vestingAmount.div(2));

      // Claim all tokens after vesting has been completed
      await setNextBlockTime(targetTime + 4 * WEEK_IN_SECONDS);
      await expect(user1pool.claimVestedTokens(vestingHash, user1.address, MAX_UINT128))
        .to.emit(pool, 'ClaimedVesting')
        .withArgs(vestingHash, user1.address)
        .and.to.emit(token, 'Transfer')
        .withArgs(pool.address, user1.address, vestingAmount.div(2));

      amounts = await pool.calculateVestedAmount(vestingHash);
      expect(amounts.vestedAmount).to.be.eq(vestingAmount);
      expect(amounts.claimedAmount).to.be.eq(vestingAmount);
    });

    it('can claim available tokens multiple times to different accounts', async () => {
      const { pool, token, vestingLibrary } = await setupTests();
      pool.initialize(token.address, poolManager.address, user1.address);
      const user1pool = pool.connect(user1);
      const vestingAmount = ethers.utils.parseUnits('1000', 18);
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
      const vesting = await pool.vestings(vestingHash);
      expect(vesting.amount).to.be.eq(vestingAmount);
      expect(vesting.amountClaimed).to.be.eq(0);

      await setNextBlockTime(targetTime + WEEK_IN_SECONDS);
      const claimAmount = vestingAmount.div(4);
      await expect(user1pool.claimVestedTokens(vestingHash, user1.address, claimAmount))
        .to.emit(pool, 'ClaimedVesting')
        .withArgs(vestingHash, user1.address)
        .and.to.emit(token, 'Transfer')
        .withArgs(pool.address, user1.address, claimAmount);
      let amounts = await pool.calculateVestedAmount(vestingHash);
      expect(amounts.vestedAmount).to.be.eq(vestingAmount.div(2));
      expect(amounts.claimedAmount).to.be.eq(claimAmount);

      await expect(user1pool.claimVestedTokens(vestingHash, user1.address, claimAmount))
        .to.emit(pool, 'ClaimedVesting')
        .withArgs(vestingHash, user1.address)
        .and.to.emit(token, 'Transfer')
        .withArgs(pool.address, user1.address, claimAmount);
      amounts = await pool.calculateVestedAmount(vestingHash);
      expect(amounts.vestedAmount).to.be.gt(vestingAmount.div(2));
      expect(amounts.claimedAmount).to.be.eq(claimAmount.mul(2));

      await setNextBlockTime(targetTime + 2 * WEEK_IN_SECONDS);
      await expect(user1pool.claimVestedTokens(vestingHash, user2.address, claimAmount))
        .to.emit(pool, 'ClaimedVesting')
        .withArgs(vestingHash, user2.address)
        .and.to.emit(token, 'Transfer')
        .withArgs(pool.address, user2.address, claimAmount);
      amounts = await pool.calculateVestedAmount(vestingHash);
      expect(amounts.vestedAmount).to.be.eq(vestingAmount);
      expect(amounts.claimedAmount).to.be.eq(claimAmount.mul(3));

      await expect(user1pool.claimVestedTokens(vestingHash, user1.address, claimAmount))
        .to.emit(pool, 'ClaimedVesting')
        .withArgs(vestingHash, user1.address)
        .and.to.emit(token, 'Transfer')
        .withArgs(pool.address, user1.address, claimAmount);
      amounts = await pool.calculateVestedAmount(vestingHash);
      expect(amounts.vestedAmount).to.be.eq(vestingAmount);
      expect(amounts.claimedAmount).to.be.eq(vestingAmount);
    });
  });
});
