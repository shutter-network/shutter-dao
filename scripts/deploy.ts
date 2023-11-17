import { logShutterDaoTxt, logEthereumLogo } from "./graphics/graphics";

async function createDAO() {

  logShutterDaoTxt();

  logEthereumLogo();
}

createDAO()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
