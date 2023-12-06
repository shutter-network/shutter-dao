import { expect } from 'chai';
import { deployments, ethers, waffle } from 'hardhat';
import '@nomiclabs/hardhat-ethers';
import {
  deployTestToken,
  getAirdropContract,
  getVestingLibraryContract,
  getVestingPoolContract,
  getVestingPoolManager,
  getVestingPoolManagerContract,
} from '../utils/setup';
import { setNextBlockTime } from '../utils/state';

describe('Airdrop - Setup', async () => {
  const redeemDeadline = new Date().getTime() + 60 * 60 * 1000;
  const [airdropManager, user1, user2] = waffle.provider.getWallets();
  const maxUint256Bytes32 = ethers.utils.hexZeroPad(
    ethers.utils.hexlify(ethers.constants.MaxUint256),
    32,
  );

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

  describe('initializeRoot', async () => {
    it('should revert if not pool manager', async () => {
      const { airdrop } = await setupTests();
      const user2Airdrop = airdrop.connect(user2);
      expect(await airdrop.root()).to.be.eq(ethers.constants.HashZero);
      await expect(user2Airdrop.initializeRoot(maxUint256Bytes32)).to.be.revertedWith(
        'Can only be called by pool manager',
      );
      expect(await airdrop.root()).to.be.eq(ethers.constants.HashZero);
    });

    it('should revert if initialized twice', async () => {
      const { airdrop } = await setupTests();

      await airdrop.initializeRoot(maxUint256Bytes32);
      await expect(airdrop.initializeRoot(maxUint256Bytes32)).to.be.revertedWith(
        'State root already initialized',
      );
    });

    it('set storage root', async () => {
      const { airdrop } = await setupTests();
      await airdrop.initializeRoot(maxUint256Bytes32);
      expect(await airdrop.root()).to.be.eq(ethers.constants.MaxUint256);
    });
  });

  describe('constructor', async () => {
    it('should revert with redeem date in the past', async () => {
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
      await expect(
        airdropContract.deploy(
          token.address,
          airdropManager.address,
          0,
          vestingPoolManager.address,
        ),
      ).to.be.revertedWith('Redeem deadline should be in the future');
    });

    it('should revert with redeem date at current time', async () => {
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

      setNextBlockTime(redeemDeadline);
      await expect(
        airdropContract.deploy(
          token.address,
          airdropManager.address,
          redeemDeadline,
          vestingPoolManager.address,
        ),
      ).to.be.revertedWith('Redeem deadline should be in the future');
    });
  });
});
