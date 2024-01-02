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
import { setNextBlockTime } from '../utils/state';

const { AddressZero } = ethers.constants;

describe('Airdrop - Setup', async () => {
  const redeemDeadline = new Date().getTime() + 60 * 60 * 1000;
  const [airdropManager] = waffle.provider.getWallets();
  const maxUint256Bytes32 = ethers.utils.hexZeroPad(
    ethers.utils.hexlify(ethers.constants.MaxUint256),
    32,
  );

  const setupTests = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture(['VestingLibrary']);
    const airdropContract = await getAirdropContract();
    const token = await deployTestToken(airdropManager.address);
    const vestingLibraryContract = await getVestingLibraryContract();
    const vestingLibrary = await vestingLibraryContract.deploy();
    const poolContract = await getVestingPoolContract(vestingLibrary.address);
    const vestingPool = await poolContract.deploy(AddressZero);
    const vestingPoolManagerContract = await getVestingPoolManagerContract();
    const vestingPoolManager = await vestingPoolManagerContract.deploy(
      token.address,
      vestingPool.address,
      airdropManager.address,
    );

    return {
      token,
      vestingPool,
      vestingPoolManager,
      airdropContract,
    };
  });

  describe('constructor', async () => {
    it('should have correct root set', async () => {
      console.log(maxUint256Bytes32);
      const { token, vestingPoolManager, airdropContract } = await setupTests();
      const airdrop = await airdropContract.deploy(
        token.address,
        airdropManager.address,
        redeemDeadline,
        vestingPoolManager.address,
        maxUint256Bytes32,
      );
      expect(await airdrop.root()).to.be.eq(maxUint256Bytes32);
    });

    it('should not be able to init the contract without root hash', async () => {
      const { token, vestingPoolManager, airdropContract } = await setupTests();
      expect(
        airdropContract.deploy(
          token.address,
          airdropManager.address,
          redeemDeadline,
          vestingPoolManager.address,
          ethers.utils.hexZeroPad(ethers.utils.hexlify(ethers.constants.Zero), 32),
        ),
      ).to.be.revertedWith('State root should be set');
    });

    it('should revert with redeem date in the past', async () => {
      const { airdropContract, token, vestingPoolManager } = await setupTests();
      await expect(
        airdropContract.deploy(
          token.address,
          airdropManager.address,
          0,
          vestingPoolManager.address,
          maxUint256Bytes32,
        ),
      ).to.be.revertedWith('Redeem deadline should be in the future');
    });

    it('should revert with redeem date at current time', async () => {
      const { airdropContract, token, vestingPoolManager } = await setupTests();

      setNextBlockTime(redeemDeadline);
      await expect(
        airdropContract.deploy(
          token.address,
          airdropManager.address,
          redeemDeadline,
          vestingPoolManager.address,
          maxUint256Bytes32,
        ),
      ).to.be.revertedWith('Redeem deadline should be in the future');
    });
  });
});
