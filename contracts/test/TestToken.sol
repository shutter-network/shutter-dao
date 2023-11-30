// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.22;

import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Votes } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title Shutter Token contract
/// Copied from Safe Token - author Richard Meissner - rmeissner
contract TestToken is ERC20Votes, Pausable, Ownable {
    // Custom errors
    error NotPaused();
    error TransferToTokenContract();
    error TransferWhilePaused();

    /// @dev Will mint 1 billion tokens to the owner and pause the contract
    constructor(
        address owner
    )
    ERC20("TestToken", "TT")
    EIP712("TestToken", "1.0.0")
    Ownable(owner)
    {
        // Transfer ownership immediately
        _transferOwnership(owner);
        // "ether" is used here to get 18 decimals
        _mint(owner, 1_000_000_000 ether);
    }

    /// @notice Unpauses all token transfers.
    function unpause() public virtual onlyOwner {
        if (!paused()) revert NotPaused();
        _unpause();
    }

    function pause() public virtual onlyOwner {
        if (paused()) revert NotPaused();
        _pause();
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
