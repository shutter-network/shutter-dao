import '@nomiclabs/hardhat-ethers';

import { ethers } from 'hardhat';

const deployContracts = async function ({ deployments }) {
  const { deploy } = deployments;

  const [deployer] = await ethers.getSigners();

  const vestingLibrary = await deployments.get('VestingLibrary');
  const vestingPool = await deploy('VestingPool', {
    from: await deployer.getAddress(),
    args: [],
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
