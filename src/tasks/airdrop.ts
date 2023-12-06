import 'hardhat-deploy';
import '@nomiclabs/hardhat-ethers';
import { task, types } from 'hardhat/config';

task('airdrop_info', 'Prints vesting details')
  .addPositionalParam('airdrop', 'Airdrop which should be queried', '', types.string)
  .setAction(async (taskArgs, hre) => {
    const airdrop = await hre.ethers.getContractAt('Airdrop', taskArgs.airdrop);

    const tokenAddress = await airdrop.token();
    console.log({
      airdrop: airdrop.address,
      tokenAddress,
      manager: await airdrop.airdropManager(),
      root: await airdrop.root(),
      redeemDeadline: await airdrop.redeemDeadline(),
    });
  });
