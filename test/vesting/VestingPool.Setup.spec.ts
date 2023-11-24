import { expect } from 'chai';
import { deployments, ethers, waffle } from 'hardhat';
import '@nomiclabs/hardhat-ethers';
import { deployTestToken, getVestingPoolContract } from '../utils/setup';

describe('VestingPool - Setup', async () => {
  const [poolManager, user1, user2] = waffle.provider.getWallets();

  const setupTests = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture();
    const poolContract = await getVestingPoolContract();
    const token = await deployTestToken(poolManager.address);
    const pool = await poolContract.deploy();

    await token.transfer(user1.address, ethers.utils.parseUnits('400000', 18));

    return {
      token,
      pool,
    };
  });

  describe('addVesting', async () => {
    it('should revert if not pool manager', async () => {
      const { pool, token } = await setupTests();
      await pool.initialize(token.address, poolManager.address, user1.address);
      const currentTime = new Date().getTime();
      const userPool = pool.connect(user1);
      await expect(
        userPool.addVesting(0, true, 104, currentTime, ethers.utils.parseUnits('200000', 18), 0),
      ).to.be.revertedWith('Can only be called by pool manager');
    });

    it('should revert if no balance available', async () => {
      const { pool, token } = await setupTests();
      await pool.initialize(token.address, poolManager.address, user1.address);
      const currentTime = new Date().getTime();
      await expect(
        pool.addVesting(0, true, 104, currentTime, ethers.utils.parseUnits('200000', 18), 0),
      ).to.be.revertedWith('Not enough tokens available');
    });

    it('should revert with invalid vesting curve', async () => {
      const { pool, token } = await setupTests();
      await pool.initialize(token.address, poolManager.address, user1.address);
      const vestingAmount = ethers.utils.parseUnits('200000', 18);
      const currentTime = (await ethers.provider.getBlock('latest')).timestamp;
      await token.transfer(pool.address, vestingAmount);
      await expect(pool.addVesting(2, true, 104, currentTime, vestingAmount, 0)).to.be.revertedWith(
        'Invalid vesting curve',
      );
    });

    it('should revert if vesting pool is initiated for zero address', async () => {
      const { pool, token } = await setupTests();

      await expect(
        pool.initialize(token.address, poolManager.address, ethers.constants.AddressZero),
      ).to.be.revertedWith('Invalid account');
    });

    it('should revert if same vesting is added twice', async () => {
      const { pool, token } = await setupTests();
      await pool.initialize(token.address, poolManager.address, user1.address);
      const vestingAmount = ethers.utils.parseUnits('200000', 18);
      const currentTime = (await ethers.provider.getBlock('latest')).timestamp;
      // 1h in the future
      const targetTime = currentTime + 3600;
      await token.transfer(pool.address, vestingAmount);
      await pool.addVesting(0, true, 104, targetTime, vestingAmount, 0);
      await expect(pool.addVesting(0, true, 104, targetTime, vestingAmount, 0)).to.be.revertedWith(
        'Vesting id already used',
      );
    });

    it('can add linear vesting that starts in the future', async () => {
      const { pool, token } = await setupTests();
      await pool.initialize(token.address, poolManager.address, user1.address);
      const vestingAmount = ethers.utils.parseUnits('200000', 18);
      const currentTime = (await ethers.provider.getBlock('latest')).timestamp;
      // 1h in the future
      const targetTime = currentTime + 3600;
      await token.transfer(pool.address, vestingAmount);
      const vestingHash = await pool.vestingHash(0, true, 104, targetTime, vestingAmount, 0);
      await expect(pool.addVesting(0, true, 104, targetTime, vestingAmount, 0))
        .to.emit(pool, 'AddedVesting')
        .withArgs(vestingHash);
      await expect(pool.calculateVestedAmount(vestingHash)).to.be.revertedWith(
        'Vesting not active yet',
      );
    });

    it('can add linear vesting that starts in the past', async () => {
      const { pool, token } = await setupTests();
      await pool.initialize(token.address, poolManager.address, user1.address);
      const vestingAmount = ethers.utils.parseUnits('200000', 18);
      const currentTime = (await ethers.provider.getBlock('latest')).timestamp;
      // 1h in the past
      const targetTime = currentTime - 3600;
      await token.transfer(pool.address, vestingAmount);
      const vestingHash = await pool.vestingHash(0, true, 104, targetTime, vestingAmount, 0);
      await expect(pool.addVesting(0, true, 104, targetTime, vestingAmount, 0))
        .to.emit(pool, 'AddedVesting')
        .withArgs(vestingHash);
      const { vestedAmount } = await pool.calculateVestedAmount(vestingHash);
      // Expected value after exactly 60 minutes
      expect(vestedAmount).to.be.gte(ethers.utils.parseUnits('11.4468864469', 18));
      // Expected value after exactly 61 minutes
      expect(vestedAmount).to.be.lt(ethers.utils.parseUnits('11.6376678877', 18));
      expect(await pool.totalTokensInVesting()).to.be.eq(vestingAmount);
    });

    it('can add exponential vesting that starts in the future', async () => {
      const { pool, token } = await setupTests();
      await pool.initialize(token.address, poolManager.address, user1.address);
      const vestingAmount = ethers.utils.parseUnits('400000', 18);
      const currentTime = (await ethers.provider.getBlock('latest')).timestamp;
      // 1h in the future
      const targetTime = currentTime + 3600;
      await token.transfer(pool.address, vestingAmount);
      const vestingHash = await pool.vestingHash(1, true, 104, targetTime, vestingAmount, 0);
      await expect(pool.addVesting(1, true, 104, targetTime, vestingAmount, 0))
        .to.emit(pool, 'AddedVesting')
        .withArgs(vestingHash);
      await expect(pool.calculateVestedAmount(vestingHash)).to.be.revertedWith(
        'Vesting not active yet',
      );
    });

    it('can add exponential vesting that starts in the past', async () => {
      const { pool, token } = await setupTests();
      await pool.initialize(token.address, poolManager.address, user1.address);
      const vestingAmount = ethers.utils.parseUnits('400000', 18);
      const currentTime = (await ethers.provider.getBlock('latest')).timestamp;
      // 1h in the past
      const targetTime = currentTime - 3600;
      await token.transfer(pool.address, vestingAmount);
      const vestingHash = await pool.vestingHash(1, true, 208, targetTime, vestingAmount, 0);
      await expect(pool.addVesting(1, true, 208, targetTime, vestingAmount, 0))
        .to.emit(pool, 'AddedVesting')
        .withArgs(vestingHash);
      const { vestedAmount } = await pool.calculateVestedAmount(vestingHash);
      // Expected value after exactly 60 minutes
      expect(vestedAmount).to.be.gte(ethers.utils.parseUnits('0.00032757802', 18));
      // Expected value after exactly 61 minutes
      expect(vestedAmount).to.be.lt(ethers.utils.parseUnits('0.00033858828', 18));
      expect(await pool.totalTokensInVesting()).to.be.eq(vestingAmount);
    });

    it('can add multiple vestings for same user', async () => {
      const { pool, token } = await setupTests();
      await pool.initialize(token.address, poolManager.address, user1.address);
      const vestingAmount1 = ethers.utils.parseUnits('400000', 18);
      const currentTime = (await ethers.provider.getBlock('latest')).timestamp;

      // 1h in the past
      const targetTime = currentTime - 3600;

      // Transfer tokens for first vesting
      await token.transfer(pool.address, vestingAmount1.add(ethers.utils.parseUnits('100000', 18)));
      // Add first vesting
      const vestingHash1 = await pool.vestingHash(1, true, 208, targetTime, vestingAmount1, 0);
      await expect(pool.addVesting(1, true, 208, targetTime, vestingAmount1, 0))
        .to.emit(pool, 'AddedVesting')
        .withArgs(vestingHash1);

      // Check pool state
      expect(await pool.totalTokensInVesting()).to.be.eq(vestingAmount1);
      // Check first vesting
      const { vestedAmount: vestedAmount1 } = await pool.calculateVestedAmount(vestingHash1);
      // Expected value after exactly 60 minutes
      expect(vestedAmount1).to.be.gte(ethers.utils.parseUnits('0.00032757802', 18));
      // Expected value after exactly 61 minutes
      expect(vestedAmount1).to.be.lt(ethers.utils.parseUnits('0.00033858828', 18));

      // Try to add second vesting
      const vestingAmount2 = ethers.utils.parseUnits('200000', 18);
      await expect(
        pool.addVesting(0, true, 104, currentTime, vestingAmount2, 0),
      ).to.be.revertedWith('Not enough tokens available');

      // Transfer tokens for second vesting
      await token.transfer(pool.address, vestingAmount1);
      // Add second vesting
      const vestingHash2 = await pool.vestingHash(0, true, 104, targetTime, vestingAmount2, 0);
      await expect(pool.addVesting(0, true, 104, targetTime, vestingAmount2, 0))
        .to.emit(pool, 'AddedVesting')
        .withArgs(vestingHash2);

      // Check pool state
      expect(await pool.totalTokensInVesting()).to.be.eq(vestingAmount1.add(vestingAmount2));
      // Check second vesting
      const { vestedAmount: vestedAmount2 } = await pool.calculateVestedAmount(vestingHash2);
      // Expected value after exactly 60 minutes
      expect(vestedAmount2).to.be.gte(ethers.utils.parseUnits('11.4468864469', 18));
      // Expected value after exactly 61 minutes
      expect(vestedAmount2).to.be.lt(ethers.utils.parseUnits('11.6376678877', 18));
    });
  });
});
