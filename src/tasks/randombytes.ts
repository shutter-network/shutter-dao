import 'hardhat-deploy';
import '@nomiclabs/hardhat-ethers';
import { task, types } from 'hardhat/config';
import { getRandomBytes } from '../../DaoBuilder/utils';
task('random-bytes', 'Genreate random bytes')
.setDescription('Can be used as a value for SAFE_SALT in .env file')
  .setAction(async (taskArgs, hre) => {
    console.log(getRandomBytes());
  });
