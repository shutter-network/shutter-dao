// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.22 <0.9.0;

import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Votes } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title Shutter Token contract
/// @author Daniel Dimitrov - @compojoom, Fred Lührs - @fredo
contract ShutterToken is ERC20Votes, Pausable, Ownable {
    // Custom errors
    error NotPaused();
    error TransferToTokenContract();
    error TransferWhilePaused();
    error AlreadyInitialized();
    error NotInitialized();

    bool private initialized = false;

    /// @dev Will mint 1 billion tokens to the owner and pause the contract
    constructor(
        address owner
    )
        ERC20("Shutter Token", "SHU")
        EIP712("ShutterToken", "1.0.0")
        Ownable(owner)
    {
        // Contract is paused by default
        _pause();
    }

    function initialize(
        address newOwner,
        address airdropContract,
        uint airdropContractBalance
    ) public virtual onlyOwner {
        if (initialized) revert AlreadyInitialized();
        initialized = true;
        // "ether" is used here to get 18 decimals
        uint256 tokensForDeployer = 100_000 ether;
        uint256 tokensForAirdropContract = airdropContractBalance;
        uint256 tokensForNewOwner = _maxSupply() - tokensForDeployer - tokensForAirdropContract;

        _mint(newOwner, tokensForNewOwner);
        _mint(airdropContract, tokensForAirdropContract);

        // Give deployer some tokens
        _mint(msg.sender, tokensForDeployer);

        // Transfer ownership
        _transferOwnership(newOwner);
    }

    function _maxSupply() internal pure override returns (uint256) {
        return 1_000_000_000 ether;
    }

    /// @notice Unpauses all token transfers.
    function unpause() public virtual onlyOwner {
        if (!initialized) revert NotInitialized();
        if (!paused()) revert NotPaused();
        _unpause();
    }

    /// @dev See {ERC20-_update}
    /// @param from The account that is sending the tokens
    /// @param to The account that should receive the tokens
    /// @param amount Amount of tokens that should be transferred
    function _update(
        address from,
        address to,
        uint256 amount
    ) internal virtual override(ERC20Votes) {
        super._update(from, to, amount);

        if (to == address(this)) revert TransferToTokenContract();
        if (paused() && owner() != _msgSender()) revert TransferWhilePaused();
    }
}
