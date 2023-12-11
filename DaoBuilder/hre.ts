import { HardhatRuntimeEnvironment } from 'hardhat/types';

let hre: HardhatRuntimeEnvironment | undefined;

export function getHRE(): HardhatRuntimeEnvironment {
  if (!hre) {
    hre = require('hardhat');
  }
  return hre as HardhatRuntimeEnvironment;
}

export function setHRE(_hre: HardhatRuntimeEnvironment): void {
  hre = _hre;
}