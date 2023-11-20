import { logShutterDaoTxt, logEthereumLogo } from "./graphics/graphics";
import { ethers } from "hardhat";

async function createDAO() {
  logShutterDaoTxt();

  const [deployer] = await ethers.getSigners();
  const shutterTokenFactory = await ethers.getContractFactory("ShutterToken");
  const shutterTokenContract = await shutterTokenFactory.deploy(
    await deployer.getAddress()
  );

  console.log('shutter token deployed at: ' + shutterTokenContract.address);


  logEthereumLogo();
}

createDAO()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
