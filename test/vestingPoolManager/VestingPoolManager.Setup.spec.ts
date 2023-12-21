import { expect } from 'chai';
import { deployments, ethers, waffle } from 'hardhat';
import '@nomiclabs/hardhat-ethers';
import {
  deployTestToken,
  getExecutor,
  getMock,
  getTestTokenContract,
  getUserVestingProxy,
  getVestingLibraryContract,
  getVestingPoolContract,
  getVestingPoolManagerContract,
} from '../utils/setup';

describe('VestingPoolManager - Setup', async () => {
  const [poolManager, user1, user2] = waffle.provider.getWallets();

  const setupTests = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture(['ShutterToken', 'VestingLibrary', 'VestingPool']);

    const vestingLibraryContract = await getVestingLibraryContract();
    const vestingLibrary = await vestingLibraryContract.deploy();
    const poolContract = await getVestingPoolContract(vestingLibrary.address);
    const vestingPoolManagerContract = await getVestingPoolManagerContract();
    const token = await deployTestToken(poolManager.address);
    const pool = await poolContract.deploy();

    const vestingPoolManager = await vestingPoolManagerContract.deploy(
      token.address,
      pool.address,
      poolManager.address,
    );

    return {
      token,
      pool,
      vestingPoolManager,
      vestingLibrary,
    };
  });

  const setupTestsWithMock = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture(['ShutterToken', 'VestingLibrary', 'VestingPool']);
    const executor = await getExecutor();
    const vestingLibraryContract = await getVestingLibraryContract();
    const vestingLibrary = await vestingLibraryContract.deploy();
    const poolContract = await getVestingPoolContract(vestingLibrary.address);
    const vestingPoolManagerContract = await getVestingPoolManagerContract();
    const tokenContract = await getTestTokenContract();
    // const token = await deployTestToken(poolManager.address);
    const mock = await getMock();
    const token = tokenContract.attach(mock.address);
    const pool = await poolContract.deploy();

    const vestingPoolManager = await vestingPoolManagerContract.deploy(
      token.address,
      pool.address,
      executor.address,
    );

    return {
      token,
      pool,
      vestingPoolManager,
      vestingLibrary,
      executor,
      mock,
    };
  });

  it('should be able to create a vesting pool', async () => {
    const { token, vestingPoolManager, vestingLibrary } = await setupTests();
    const currentTime = new Date().getTime();

    const amount = ethers.utils.parseUnits('200000', 18);

    let vestingHash = await vestingLibrary.vestingHash(
      user1.address,
      0,
      true,
      104,
      currentTime,
      amount,
      0,
    );

    await token.approve(vestingPoolManager.address, amount);

    expect(await vestingPoolManager.addVesting(user1.address, 0, true, 104, currentTime, amount, 0))
      .to.emit(await getUserVestingProxy(vestingPoolManager, user1.address), 'AddedVesting')
      .withArgs(vestingHash);

    await token.transfer(user1.address, amount);
    await token.connect(user1).approve(vestingPoolManager.address, amount);

    vestingHash = await vestingLibrary.vestingHash(
      user2.address,
      0,
      true,
      104,
      currentTime,
      amount,
      0,
    );

    const connected = vestingPoolManager.connect(user1);
    expect(await connected.addVesting(user2.address, 0, true, 104, currentTime, amount, 0))
      .to.emit(await getUserVestingProxy(connected, user2.address), 'AddedVesting')
      .withArgs(vestingHash);
  });

  it('should be able to create a vesting pool if poolManager and token paused', async () => {
    const { token, vestingPoolManager, vestingLibrary, executor, mock } =
      await setupTestsWithMock();

    await token.pause();

    const amount = ethers.utils.parseUnits('200000', 18);

    await token.transferOwnership(executor.address);

    await executor.enableModule(vestingPoolManager.address);
    const currentTime = new Date().getTime();

    await mock.givenMethodReturnUint(token.interface.getSighash('balanceOf'), amount);

    const vestingHash = await vestingLibrary.vestingHash(
      user1.address,
      0,
      true,
      104,
      currentTime,
      amount,
      0,
    );

    await expect(vestingPoolManager.addVesting(user1.address, 0, true, 104, currentTime, amount, 0, false))
      .to.emit(await getUserVestingProxy(vestingPoolManager, user1.address), 'AddedVesting')
      .withArgs(vestingHash);
  });

});
