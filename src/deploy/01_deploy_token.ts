import '@nomiclabs/hardhat-ethers';

import { ethers } from 'hardhat';

const deployContracts = async function ({ deployments }) {
  const { deploy } = deployments;

  const [deployer] = await ethers.getSigners();

  await deploy('ShutterToken', {
    from: await deployer.getAddress(),
    args: [await deployer.getAddress()],
    log: true,
  });

  return true;
};

deployContracts.tags = ['ShutterToken'];
deployContracts.id = 'ShutterToken';
export default deployContracts;
