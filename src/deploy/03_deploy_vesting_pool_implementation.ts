import '@nomiclabs/hardhat-ethers';

import { ethers } from 'hardhat';
import { getDeploymentArguments } from '../utils/deploy';

const deployContracts = async function ({ deployments, config, network }) {
  const { deploy } = deployments;

  const [deployer] = await ethers.getSigners();

  const networkName = network.name;
  const tokenAddress = getDeploymentArguments<string>('SPT_TOKEN_ADDRESS', config, networkName);

  console.log('tokenAddress', tokenAddress )
  const vestingLibrary = await deployments.get('VestingLibrary');
  const vestingPool = await deploy('VestingPool', {
    from: await deployer.getAddress(),
    args: [tokenAddress],
    libraries: {
      VestingLibrary: vestingLibrary.address,
    },
    log: true,
  });

  console.table({
    vestingPoolImplementation: vestingPool.address,
  });

  return true;
};

deployContracts.tags = ['VestingPool'];
deployContracts.dependencies = ['VestingLibrary'];
deployContracts.id = 'VestingPool';
export default deployContracts;
