import '@nomiclabs/hardhat-ethers';

import { ethers } from 'hardhat';
import {AddrsSeq} from "../../typechain";

const deployContracts = async function ({ deployments }) {
  const { deploy } = deployments;

  const [deployer] = await ethers.getSigners();

  const keypersDeployment = await deploy('Keypers', {
    contract: 'AddrsSeq',
    from: await deployer.getAddress(),
    args: [],
    log: true,
  });

  const keypers = (await ethers.getContractAt('AddrsSeq', keypersDeployment.address)) as AddrsSeq;
  await (await keypers.append()).wait();

  return true;
};

deployContracts.tags = ['Keypers'];
deployContracts.id = 'Keypers';
export default deployContracts;
