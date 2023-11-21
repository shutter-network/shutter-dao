// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.22 <0.9.0;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title Shutter Token contract
/// Copied from Safe Token - author Richard Meissner - rmeissner
contract ShutterToken is ERC20Votes, Pausable, Ownable {
    /// @dev Will mint 1 billion tokens to the owner and pause the contract
    constructor(address owner) ERC20("Shutter Token", "SHU") EIP712("ShutterToken", "1.0.0") Ownable(owner) {
        // Transfer ownership immediately
        _transferOwnership(owner);
        // "ether" is used here to get 18 decimals
        _mint(owner, 1_000_000_000 ether);
        // Contract is paused by default
        // This has to be done after _mint, else minting will fail
        _pause();
    }

    /// @notice Unpauses all token transfers.
    /// @dev See {Pausable-_unpause}
    /// Requirements: caller must be the owner
    function unpause() public virtual onlyOwner {
        require(paused(), "ShutterToken: token is not paused");
        _unpause();
    }

    /// @dev See {ERC20-_update}
    /// Requirements: the contract must not be paused OR transfer must be initiated by owner
    /// @param from The account that is sending the tokens
    /// @param to The account that should receive the tokens
    /// @param amount Amount of tokens that should be transferred
    function _update(
        address from,
        address to,
        uint256 amount
    ) internal virtual override(ERC20Votes) {
        super._update(from, to, amount);

        require(to != address(this), "ShutterToken: cannot transfer tokens to token contract");
        // Token transfers are only possible if the contract is not paused
        // OR if triggered by the owner of the contract
        require(!paused() || owner() == _msgSender(), "ShutterToken: token transfer while paused");
    }

}
