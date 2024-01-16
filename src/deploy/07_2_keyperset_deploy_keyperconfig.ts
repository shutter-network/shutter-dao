import '@nomiclabs/hardhat-ethers';

import { ethers } from 'hardhat';

const deployContracts = async function ({ deployments }) {
  const { deploy } = deployments;

  const [deployer] = await ethers.getSigners();

  const keypers = await deployments.get('Keypers');

  await deploy('KeyperConfig', {
    contract: 'KeypersConfigsList',
    from: await deployer.getAddress(),
    args: [keypers.address],
    log: true,
  });

  return true;
};

deployContracts.tags = ['KeyperConfig'];
deployContracts.dependencies = ['Keypers'];
deployContracts.id = 'KeyperConfig';
export default deployContracts;
