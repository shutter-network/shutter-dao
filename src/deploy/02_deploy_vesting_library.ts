import '@nomiclabs/hardhat-ethers';

import { ethers } from 'hardhat';

const deployContracts = async function ({ deployments }) {
  const { deploy } = deployments;

  const [deployer] = await ethers.getSigners();

  const vestingLibrary = await deploy('VestingLibrary', {
    from: await deployer.getAddress(),
    args: [],
    log: true,
  });

    console.table({
    vestingLibrary: vestingLibrary.address,
  });
  return true;
};

deployContracts.tags = ['VestingLibrary'];
deployContracts.id = 'VestingLibrary';
export default deployContracts;
