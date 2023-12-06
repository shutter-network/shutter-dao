import { expect } from 'chai';
import { deployments, ethers, waffle } from 'hardhat';
import '@nomiclabs/hardhat-ethers';
import { deployTestToken, getVestingLibraryContract, getVestingPoolContract } from '../utils/setup';
import { Contract } from 'ethers';
import { Vesting } from '../../src/utils/types';
import { calculateVestingHash } from '../../src/utils/hash';

describe('VestingPool - Hash', async () => {
  const [poolManager, user1, user2] = waffle.provider.getWallets();

  const setupTests = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture(['ShutterToken', 'VestingLibrary', 'VestingPool']);
    const vestingLibraryContract = await getVestingLibraryContract();
    const vestingLibrary = await vestingLibraryContract.deploy();
    const poolContract = await getVestingPoolContract(vestingLibrary.address);
    const token = await deployTestToken(poolManager.address);
    const pool = await poolContract.deploy();
    await pool.initialize(token.address, poolManager.address, user1.address);
    return {
      token,
      pool,
      vestingLibrary,
    };
  });

  const chainId = async () => {
    return (await ethers.provider.getNetwork()).chainId;
  };

  const getVestingHash = async (vestingLibrary: Contract, vesting: Vesting) => {
    return await vestingLibrary.vestingHash(
      vesting.owner,
      vesting.curveType,
      vesting.managed,
      vesting.durationWeeks,
      vesting.startDate,
      vesting.amount,
      vesting.initialUnlock,
    );
  };

  describe('vestingHash', async () => {
    it('calculate correct hash for managed vesting', async () => {
      const { vestingLibrary } = await setupTests();
      const vesting: Vesting = {
        owner: user1.address,
        curveType: 0,
        managed: true,
        durationWeeks: 104,
        startDate: 1700852771657,
        amount: ethers.utils.parseUnits('200000', 18),
        initialUnlock: ethers.utils.parseUnits('0', 18),
      };

      expect(await getVestingHash(vestingLibrary, vesting)).to.be.eq(calculateVestingHash(vesting));
    });

    it('calculate correct hash for unmanaged vesting', async () => {
      const { vestingLibrary } = await setupTests();
      const vesting: Vesting = {
        owner: user1.address,
        curveType: 0,
        managed: false,
        durationWeeks: 104,
        startDate: new Date().getTime(),
        amount: ethers.utils.parseUnits('200000', 18),
        initialUnlock: 0,
      };
      expect(await getVestingHash(vestingLibrary, vesting)).to.be.eq(
        calculateVestingHash(vesting),
      );
    });

    it('calculate correct hash for exponential vesting', async () => {
      const { vestingLibrary } = await setupTests();
      const vesting: Vesting = {
        owner: user1.address,
        curveType: 1,
        managed: true,
        durationWeeks: 104,
        startDate: new Date().getTime(),
        amount: ethers.utils.parseUnits('200000', 18),
        initialUnlock: 0,
      };
      expect(await getVestingHash(vestingLibrary, vesting)).to.be.eq(
        calculateVestingHash(vesting),
      );
    });

    it('calculate correct hash for zero amount vesting', async () => {
      const { vestingLibrary } = await setupTests();
      const vesting: Vesting = {
        owner: user1.address,
        curveType: 0,
        managed: true,
        durationWeeks: 104,
        startDate: new Date().getTime(),
        amount: 0,
        initialUnlock: 0,
      };
      expect(await getVestingHash(vestingLibrary, vesting)).to.be.eq(
        calculateVestingHash(vesting),
      );
    });
  });
});
