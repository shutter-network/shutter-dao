import '@nomiclabs/hardhat-ethers';

import { ethers } from 'hardhat';
import {AddrsSeq} from "../../typechain";

const deployContracts = async function ({ deployments }) {
  const { deploy } = deployments;

  const [deployer] = await ethers.getSigners();

  const collatorDeployment = await deploy('Collator', {
    contract: 'AddrsSeq',
    from: await deployer.getAddress(),
    args: [],
    log: true,
  });

  const collator = (await ethers.getContractAt('AddrsSeq', collatorDeployment.address)) as AddrsSeq;
  await (await collator.append()).wait();

  return true;
};

deployContracts.tags = ['Collator'];
deployContracts.id = 'Collator';
export default deployContracts;
