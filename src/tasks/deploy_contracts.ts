import 'hardhat-deploy';
import '@nomiclabs/hardhat-ethers';
import { task } from 'hardhat/config';
import { logEthereumLogo, logShutterDaoTxt } from '../utils/graphics/graphics';
import { getDeploymentArguments } from '../utils/deploy';
import { getPredictedSafeAddress } from '../../DaoBuilder/daoUtils';
import { type HardhatConfig } from '../../types/hardhat';
import { setHRE } from '../../DaoBuilder/hre';

task('deploy-contracts', 'Deploys and verifies Shutter Token & DAO contracts').setAction(
  async (_, hre) => {
    logShutterDaoTxt();

    setHRE(hre);
    const { deployments, config, network } = hre;
    const networkName = network.name;
    const safeSalt = getDeploymentArguments<string>(
      'SAFE_SALT',
      config as unknown as HardhatConfig,
      networkName,
    );
    const tokenAddress = getDeploymentArguments<string>(
      'SPT_TOKEN_ADDRESS',
      config as unknown as HardhatConfig,
      networkName,
    );

    const predictedSafeAddress = await getPredictedSafeAddress(safeSalt);
    const contractAt = await hre.ethers.provider.getCode(predictedSafeAddress);

    if (contractAt !== '0x') {
      console.error(
        `There is already a contract deployed at the predicted safe address: ${predictedSafeAddress}`,
        `Change the SAFE_SALT in .env file and try again.`,
      );
      return;
    }

    await hre.run('deploy');

    console.table([
      "",
      "🚀 Shutter DAO contracts successfully deployed 🚀",
      "",
    ]);

    await hre.run('verify-contracts');

    logEthereumLogo();
  },
);

export {};
