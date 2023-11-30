import hre, { deployments, ethers } from "hardhat";
import { Wallet, Contract } from "ethers"
import solc from "solc"
import { VestingPoolManager } from "../../typechain";

export const getAirdropContract = async () => {
    return await hre.ethers.getContractFactory("Airdrop");
}

export const getAirdrop = async () => {
    const Contract = await getAirdropContract();
    const Deployment = await deployments.get("Airdrop");
    return Contract.attach(Deployment.address);
}

export const getVestingPoolManagerContract = async () => {
    return await hre.ethers.getContractFactory("VestingPoolManager");
}

export const getVestingPoolManager = async () => {
    const Contract = await getVestingPoolManagerContract();
    const Deployment = await deployments.get("VestingPoolManager");
    return Contract.attach(Deployment.address);
}

export const getVestingLibraryContract = async () => {
    return await hre.ethers.getContractFactory("VestingLibrary");
}

export const getVestingLibrary = async () => {
    const Contract = await getVestingLibraryContract();
    const Deployment = await deployments.get("VestingLibrary");
    return Contract.attach(Deployment.address);
}

export const getVestingPoolContract = async (vestingLibraryAddress: string) => {

    return await hre.ethers.getContractFactory("VestingPool", {
        libraries: {
            VestingLibrary: vestingLibraryAddress
        }
    });
}

export const getVestingPool = async (vestingLibraryAddress: string) => {
    const Contract = await getVestingPoolContract(vestingLibraryAddress);
    const Deployment = await deployments.get("VestingPool");
    return Contract.attach(Deployment.address);
}

export const getTestTokenContract = async () => {
    return await hre.ethers.getContractFactory("TestToken");
}

export const deployTestToken = async (owner:string) => {
    const Contract = await getTestTokenContract();
    return await Contract.deploy(owner);
}

export const getToken = async () => {
    const Deployment = await deployments.get("ShutterToken");
    const Contract = await hre.ethers.getContractFactory("ShutterToken");
    return Contract.attach(Deployment.address);
}

export const getMock = async () => {
    const Mock = await hre.ethers.getContractFactory("MockContract");
    return await Mock.deploy();
}

export const getExecutor = async () => {
    const Executor = await hre.ethers.getContractFactory("TestExecutor");
    return await Executor.deploy();
}

export const compile = async (source: string) => {
    const input = JSON.stringify({
        'language': 'Solidity',
        'settings': {
            'outputSelection': {
            '*': {
                '*': [ 'abi', 'evm.bytecode' ]
            }
            }
        },
        'sources': {
            'tmp.sol': {
                'content': source
            }
        }
    });
    const solcData = await solc.compile(input)
    const output = JSON.parse(solcData);
    if (!output['contracts']) {
        console.log(output)
        throw Error("Could not compile contract")
    }
    const fileOutput = output['contracts']['tmp.sol']
    const contractOutput = fileOutput[Object.keys(fileOutput)[0]]
    const abi = contractOutput['abi']
    const data = '0x' + contractOutput['evm']['bytecode']['object']
    return {
        "data": data,
        "interface": abi
    }
}

export const deployContract = async (deployer: Wallet, source: string): Promise<Contract> => {
    const output = await compile(source)
    const transaction = await deployer.sendTransaction({ data: output.data, gasLimit: 6000000 })
    const receipt = await transaction.wait()
    return new Contract(receipt.contractAddress, output.interface, deployer)
}

export const getUserVestingProxy = async (vestingPoolManager: VestingPoolManager, address: string) => {
    return await ethers.getContractAt(
      'VestingPool',
      await vestingPoolManager.getVestingPool(address),
    );
};
