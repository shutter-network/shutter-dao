import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { ShutterToken, ShutterToken__factory, } from "../typechain";

describe("Shutter Token", async function() {
  let shutterToken: ShutterToken;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;
  let addr3: SignerWithAddress;

  const mintWhole = 1_000_000_000;
  const mintTotal = ethers.utils.parseEther(mintWhole.toString());

  beforeEach(async function() {
    [owner, addr1, addr2, addr3] = await ethers.getSigners();

    shutterToken = await new ShutterToken__factory(owner).deploy(
      owner.address
    );
  });

  describe("Token features", function() {
    describe("Minting the correct amount of tokens at deployment", function() {
      let totalSupply: BigNumber;

      beforeEach(async function() {
        totalSupply = await shutterToken.totalSupply();
      });

      it("Should mint the correct amount of tokens in wei (decimals)", async function() {
        expect(totalSupply).to.equal(mintTotal);
      });

      it("Should mint the correct amount of tokens in whole numbers", async function() {
        expect(parseInt(ethers.utils.formatEther(totalSupply))).to.eq(
          mintWhole
        );
      });
    });

  });

  describe("Transfers", function () {
    beforeEach(async function () {
      // Transfer some tokens to addr1 from owner for testing
      await shutterToken.transfer(addr3.address, 1000);
    });
    it("Should allow transfers when not paused", async function () {
      await shutterToken.unpause();
      await shutterToken.connect(owner).transfer(addr1.address, 100);
      expect(await shutterToken.balanceOf(addr1.address)).to.equal(100);
    });

    it("Should not allow transfers to the token contract itself", async function () {
      await shutterToken.unpause();
      await expect(
        shutterToken.connect(owner).transfer(shutterToken.address, 100)
      ).to.be.revertedWith("TransferToTokenContract");
    });

    it("Should not allow transfers when paused and sender is not owner", async function () {
      await expect(
        shutterToken.connect(addr3).transfer(addr2.address, 100)
      ).to.be.revertedWith("TransferWhilePaused");
    });

    it("Should allow transfers when paused if sender is owner", async function () {
      await shutterToken.connect(owner).transfer(addr1.address, 100);
      expect(await shutterToken.balanceOf(addr1.address)).to.equal(100);
    });
  });
});
