import 'hardhat-deploy';
import '@nomiclabs/hardhat-ethers';
import { task } from 'hardhat/config';
import { logEthereumLogo, logShutterDaoTxt } from '../utils/graphics/graphics';

task('deploy-contracts', 'Deploys and verifies Shutter Token & DAO contracts').setAction(
  async (_, hre) => {
    logShutterDaoTxt();
    await hre.run('deploy');
    // try {
    //     await hre.run("sourcify")
    // } catch (e) { console.error(e) }
    try {
      await hre.run('etherscan-verify', { forceLicense: true, license: 'LGPL-3.0' });
    } catch (e) {
      console.error(e);
    }

    logEthereumLogo();
  },
);

export {};
