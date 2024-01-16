import '@nomiclabs/hardhat-ethers';

import { ethers } from 'hardhat';

const deployContracts = async function ({ deployments }) {
  const { deploy } = deployments;

  const [deployer] = await ethers.getSigners();

  const collator = await deployments.get('Collator');

  await deploy('CollatorConfig', {
    contract: 'CollatorConfigsList',
    from: await deployer.getAddress(),
    args: [collator.address],
    log: true,
  });

  return true;
};

deployContracts.tags = ['CollatorConfig'];
deployContracts.dependencies = ['Collator'];
deployContracts.id = 'CollatorConfig';
export default deployContracts;
