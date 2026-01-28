// Contract ABIs
import AccountRegistryABI from './AccountRegistry.json';
import HashIDABI from './HashID.json';
import PlatformTreasuryABI from './PlatformTreasury.json';
import GroupFactoryABI from './GroupFactory.json';
import GroupNFTABI from './GroupNFT.json';
import HASHDABI from './HASHD.json';
import GroupPostsABI from './GroupPosts.json';
import GroupCommentsABI from './GroupComments.json';
import GroupTokenBondingCurveABI from './GroupTokenBondingCurve.json';
import KeyRegistryABI from './KeyRegistry.json';
import MessageContractABI from './MessageContract.json';
import UserProfileABI from './UserProfile.json';
import DeploymentRegistryABI from './DeploymentRegistry.json';
// Vault contracts
import VaultNodeRegistryABI from './VaultNodeRegistry.json';
import VaultIncentivesABI from './VaultIncentives.json';
import ContentRegistryABI from './ContentRegistry.json';
import AppRegistryABI from './AppRegistry.json';
// Storage contracts
import MessageStorageABI from './MessageStorage.json';
import KeyStorageABI from './KeyStorage.json';
import AccountStorageABI from './AccountStorage.json';
import PostStorageABI from './PostStorage.json';
import UserProfileStorageABI from './UserProfileStorage.json';
import GroupFactoryStorageABI from './GroupFactoryStorage.json';
import VaultNodeRegistryStorageABI from './VaultNodeRegistryStorage.json';
import AppRegistryStorageABI from './AppRegistryStorage.json';
import ContentRegistryStorageABI from './ContentRegistryStorage.json';

export const CONTRACT_ABIS: { [key: string]: any } = {
  'AccountRegistry': AccountRegistryABI,
  'HashID': HashIDABI,
  'PlatformTreasury': PlatformTreasuryABI,
  'GroupFactory': GroupFactoryABI,
  'GroupNFT': GroupNFTABI,
  'HASHD': HASHDABI,
  'GroupPosts': GroupPostsABI,
  'GroupComments': GroupCommentsABI,
  'GroupTokenBondingCurve': GroupTokenBondingCurveABI,
  'KeyRegistry': KeyRegistryABI,
  'MessageContract': MessageContractABI,
  'UserProfile': UserProfileABI,
  'DeploymentRegistry': DeploymentRegistryABI,
  'VaultNodeRegistry': VaultNodeRegistryABI,
  'VaultIncentives': VaultIncentivesABI,
  'ContentRegistry': ContentRegistryABI,
  'AppRegistry': AppRegistryABI,
  'MessageStorage': MessageStorageABI,
  'KeyStorage': KeyStorageABI,
  'AccountStorage': AccountStorageABI,
  'PostStorage': PostStorageABI,
  'UserProfileStorage': UserProfileStorageABI,
  'GroupFactoryStorage': GroupFactoryStorageABI,
  'VaultNodeRegistryStorage': VaultNodeRegistryStorageABI,
  'AppRegistryStorage': AppRegistryStorageABI,
  'ContentRegistryStorage': ContentRegistryStorageABI,
};
