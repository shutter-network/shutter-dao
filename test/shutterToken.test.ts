import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { assert, expect } from 'chai';
import { deployments, ethers } from 'hardhat';
import { ShutterToken } from '../typechain';

describe('Shutter Token', async function () {
  let deployer: SignerWithAddress;
  let owner: SignerWithAddress;
  let sptContract: SignerWithAddress;
  let airdrop: SignerWithAddress;
  let addr1: SignerWithAddress;

  const mintTotal = 1_000_000_000;
  const mintDeployer = 0;
  const mintOwner = 700_000_000;
  const mintSptExchangeContract = 100_000_000;
  const mintAirdropContract = 200_000_000;

  const setupTests = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture(['ShutterToken']);

    const shutterTokenDeployment = await deployments.get('ShutterToken');
    const shutterToken = (await ethers.getContractAt(
      'ShutterToken',
      shutterTokenDeployment.address,
    )) as ShutterToken;

    return {
      shutterToken,
    };
  });

  beforeEach(async function () {
    [deployer, owner, sptContract, airdrop, addr1] = await ethers.getSigners();
  });

  describe('Token features', function () {
    describe('Minting the correct amount of tokens at deployment', function () {
      it('Should have 0 tokens minted at deployment', async function () {
        const { shutterToken } = await setupTests();
        const totalSupply = await shutterToken.totalSupply();
        expect(totalSupply).to.equal(0);
      });

      it('Should change ownership and mint correct amount of tokens on initialize', async function () {
        const { shutterToken } = await setupTests();
        await shutterToken
          .connect(deployer)
          .initialize(owner.address, sptContract.address, airdrop.address);

        const totalSupply = await shutterToken.totalSupply();
        const sptBalance = await shutterToken.balanceOf(sptContract.address);
        const airdropBalance = await shutterToken.balanceOf(airdrop.address);
        const ownerBalance = await shutterToken.balanceOf(owner.address);
        const deployerBalance = await shutterToken.balanceOf(deployer.address);

        assert.equal(parseInt(ethers.utils.formatEther(totalSupply)), mintTotal);
        assert.equal(parseInt(ethers.utils.formatEther(sptBalance)), mintSptExchangeContract);
        assert.equal(parseInt(ethers.utils.formatEther(airdropBalance)), mintAirdropContract);
        assert.equal(parseInt(ethers.utils.formatEther(ownerBalance)), mintOwner);
        assert.equal(parseInt(ethers.utils.formatEther(deployerBalance)), mintDeployer);

        assert.equal(await shutterToken.owner(), owner.address);
      });
    });

    it('Should not be able to initialize twice', async function () {
      const { shutterToken } = await setupTests();
      await shutterToken
        .connect(deployer)
        .initialize(owner.address, sptContract.address, airdrop.address);
      await expect(
        shutterToken
          .connect(deployer)
          .initialize(owner.address, sptContract.address, airdrop.address),
      ).to.be.revertedWith('OwnableUnauthorizedAccount');
      await expect(
        shutterToken.connect(owner).initialize(owner.address, sptContract.address, airdrop.address),
      ).to.be.revertedWith('AlreadyInitialized');
    });
  });

  describe('Transfers', function () {
    let token: ShutterToken;
    beforeEach(async function () {
      const { shutterToken } = await setupTests();
      await shutterToken
        .connect(deployer)
        .initialize(owner.address, sptContract.address, airdrop.address);

      token = shutterToken.connect(owner);
    });
    it('Should allow transfers when not paused', async function () {
      await token.unpause();
      await token.transfer(addr1.address, 100);
      expect(await token.balanceOf(addr1.address)).to.equal(100);
    });

    it('Should not allow transfers to the token contract itself', async function () {
      await token.unpause();
      await expect(token.connect(owner).transfer(token.address, 100)).to.be.revertedWith(
        'TransferToTokenContract',
      );
    });

    it('Should not allow transfers when paused and sender is not owner', async function () {
      await expect(token.connect(airdrop).transfer(deployer.address, 100)).to.be.revertedWith(
        'TransferWhilePaused',
      );
    });

    it('Should allow transfers when paused if sender is owner', async function () {
      await token.connect(owner).transfer(addr1.address, 100);
      expect(await token.balanceOf(addr1.address)).to.equal(100);
    });
  });
});
