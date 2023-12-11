import {type HardhatConfig} from '../../types/hardhat';
export type DeploymentArgumentKeys = keyof HardhatConfig['deploymentArguments'][string];

export const getDeploymentArguments = <T>(
  key: DeploymentArgumentKeys,
  config: HardhatConfig,
  networkName: string,
): T => {
  if (!config.deploymentArguments || !config.deploymentArguments[networkName]) {
    throw new Error('deploymentArguments not found in config for network: ' + networkName);
  }

  const value = config.deploymentArguments[networkName][key];

  if (!value) {
    throw new Error(`${key} not found in config for network: ${networkName}`);
  }

  return value as T;
};
