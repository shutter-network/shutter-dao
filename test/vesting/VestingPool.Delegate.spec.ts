import { expect } from 'chai';
import { deployments, ethers, waffle } from 'hardhat';
import '@nomiclabs/hardhat-ethers';
import {
  deployTestToken,
  getVestingLibraryContract,
  getVestingPoolContract,
} from '../utils/setup';

describe('VestingPool - Delegate', async () => {
  const [poolManager, user1, user2] = waffle.provider.getWallets();

  const setupTests = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture(['ShutterToken', 'VestingLibrary', 'VestingPool']);
    const vestingLibraryContract = await getVestingLibraryContract();
    const vestingLibrary = await vestingLibraryContract.deploy();
    const poolContract = await getVestingPoolContract(vestingLibrary.address);
    const token = await deployTestToken(poolManager.address);

    const pool = await poolContract.deploy();
    return {
      token,
      pool,
      vestingLibrary,
    };
  });

  describe('delegateVestedTokens', async () => {
    it('should be able to delegate vestedTokens only by owner', async () => {
      const { pool, token } = await setupTests();
      pool.initialize(token.address, poolManager.address, user1.address);

      await expect(pool.connect(user2).delegateTokens(user2.address))
        .to.revertedWith('Can only be claimed by vesting owner');

      await expect(await pool.connect(user1).delegateTokens(user1.address))
        .to.emit(token, 'DelegateChanged')
        .withArgs(pool.address, ethers.constants.AddressZero, user1.address);
    });
    it('should be able to delegate vestedTokens', async () => {
      const { pool, token } = await setupTests();
      pool.initialize(token.address, poolManager.address, user1.address);

      await expect(await pool.connect(user1).delegateTokens(user1.address))
        .to.emit(token, 'DelegateChanged')
        .withArgs(pool.address, ethers.constants.AddressZero, user1.address);
    });

    it('should be able to delegate vestedTokens to a different address after first delegation', async () => {
      const { pool, token } = await setupTests();
      pool.initialize(token.address, poolManager.address, user1.address);

      await expect(await pool.connect(user1).delegateTokens(user1.address))
        .to.emit(token, 'DelegateChanged')
        .withArgs(pool.address, ethers.constants.AddressZero, user1.address);

      await expect(await pool.connect(user1).delegateTokens(user2.address))
        .to.emit(token, 'DelegateChanged')
        .withArgs(pool.address, user1.address, user2.address);
    });
  });
});
