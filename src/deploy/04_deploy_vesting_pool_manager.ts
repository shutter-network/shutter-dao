import '@nomiclabs/hardhat-ethers';

import { ethers } from 'hardhat';
import { getPredictedSafeAddress } from '../../DaoBuilder/daoUtils';
import { getDeploymentArguments } from '../utils/deploy';

const deployContracts = async function ({ deployments, config, network }) {
  const { deploy } = deployments;

  const [deployer] = await ethers.getSigners();

  const vestingPool = await deployments.get('VestingPool');
  const shutterToken = await deployments.get('ShutterToken');

  const networkName = network.name;
  const safeSalt = getDeploymentArguments<string>('SAFE_SALT', config, networkName);

  const predictedSafeAddress = await getPredictedSafeAddress(safeSalt);

  console.warn('predictedSafeAddress', predictedSafeAddress);

  const vestingPoolManager = await deploy('VestingPoolManager', {
    from: await deployer.getAddress(),
    args: [shutterToken.address, vestingPool.address, predictedSafeAddress],
    log: true,
  });

  console.table({
    VestingPoolManager: vestingPoolManager.address,
  });

  return true;
};

deployContracts.tags = ['VestingPoolManager'];
deployContracts.dependencies = ['ShutterToken', 'VestingLibrary', 'VestingPool'];

deployContracts.id = 'VestingPoolManager';
export default deployContracts;
