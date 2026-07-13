import Icon from '@ant-design/icons';
import { CustomIconComponentProps } from '@ant-design/icons/es/components/Icon';
import React from 'react';

import AivenSVG from '../../../../assets/svg/aiven.svg?react';
import AmazonSVG from '../../../../assets/svg/amazon.svg?react';
import AMQPSVG from '../../../../assets/svg/amqp.svg?react';
import AppCriteriaSVG from '../../../../assets/svg/app-criteria.svg?react';
import ArrowCircleSVG from '../../../../assets/svg/arrowcircle.svg?react';
import AWSSVG from '../../../../assets/svg/aws.svg?react';
import AzureSVG from '../../../../assets/svg/azure.svg?react';
import AzureSbsSVG from '../../../../assets/svg/azure-sbs.svg?react';
import BaseEnvSVG from '../../../../assets/svg/base-env.svg?react';
import BitbucketSVG from '../../../../assets/svg/bitbucket.svg?react';
import CassandraSVG from '../../../../assets/svg/cassandra.svg?react';
import CheckMarkSVG from '../../../../assets/svg/check-mark.svg?react';
import CircleCISVG from '../../../../assets/svg/circle-ci.svg?react';
import ClockSVG from '../../../../assets/svg/clock.svg?react';
import CloseSVG from '../../../../assets/svg/close.svg?react';
import CloudflareSVG from '../../../../assets/svg/cloudflare.svg?react';
import CommentsSVG from '../../../../assets/svg/comments.svg?react';
import CookieSVG from '../../../../assets/svg/cookie.svg?react';
import CopySVG from '../../../../assets/svg/copy.svg?react';
import CrossSVG from '../../../../assets/svg/cross.svg?react';
import BaseSVG from '../../../../assets/svg/default-workload.svg?react';
import DeleteSVG from '../../../../assets/svg/delete-icon.svg?react';
import DNSSVG from '../../../../assets/svg/dns.svg?react';
import DocumentsSVG from '../../../../assets/svg/documents.svg?react';
import DoubleRightArrowSVG from '../../../../assets/svg/double-right-arrow.svg?react';
import EditSVG from '../../../../assets/svg/edit.svg?react';
import ElasticSearchSVG from '../../../../assets/svg/elasticsearch.svg?react';
import EmptyDirSVG from '../../../../assets/svg/emptyDir.svg?react';
import EnvCriteriaSVG from '../../../../assets/svg/env-criteria.svg?react';
import FilterSVG from '../../../../assets/svg/filter.svg?react';
import GCPSVG from '../../../../assets/svg/gcp.svg?react';
import GenericResourceSVG from '../../../../assets/svg/generic-resource-type.svg?react';
import GitHubSVG from '../../../../assets/svg/github.svg?react';
import GoogleSVG from '../../../../assets/svg/google.svg?react';
import HappySVG from '../../../../assets/svg/happy.svg?react';
import HistorySVG from '../../../../assets/svg/history.svg?react';
import HpaSVG from '../../../../assets/svg/hpa.svg?react';
import InfoSVG from '../../../../assets/svg/info-icon.svg?react';
import IngressSVG from '../../../../assets/svg/ingress.svg?react';
import KafkaSVG from '../../../../assets/svg/kafka.svg?react';
import KubernetesSVG from '../../../../assets/svg/kubernetes.svg?react';
import LinkSVG from '../../../../assets/svg/link.svg?react';
import LockSVG from '../../../../assets/svg/lock.svg?react';
import LoggingSVG from '../../../../assets/svg/logging.svg?react';
import LogoutSVG from '../../../../assets/svg/logout.svg?react';
import MariaDBSVG from '../../../../assets/svg/mariadb.svg?react';
import MongoDBSVG from '../../../../assets/svg/mongodb.svg?react';
import MySQLSVG from '../../../../assets/svg/mysql.svg?react';
import NamespaceSVG from '../../../../assets/svg/namespace.svg?react';
import AccountSVG from '../../../../assets/svg/navbar/account.svg?react';
import ApiTokensSVG from '../../../../assets/svg/navbar/api-tokens.svg?react';
import ApplicationsSVG from '../../../../assets/svg/navbar/applications.svg?react';
import CloudAccountsSVG from '../../../../assets/svg/navbar/cloud-accounts.svg?react';
import ContainerImagesSVG from '../../../../assets/svg/navbar/container-images.svg?react';
import DocsSVG from '../../../../assets/svg/navbar/docs.svg?react';
import EnvironmentTypesSVG from '../../../../assets/svg/navbar/environment-types.svg?react';
import EnvironmentsSVG from '../../../../assets/svg/navbar/environments.svg?react';
import HideMenuSVG from '../../../../assets/svg/navbar/hide-menu.svg?react';
import OrgMembers from '../../../../assets/svg/navbar/org-members.svg?react';
import OrganizationSVG from '../../../../assets/svg/navbar/organization.svg?react';
import RegistriesSVG from '../../../../assets/svg/navbar/registries.svg?react';
import ResourcesSVG from '../../../../assets/svg/navbar/resources.svg?react';
import ShortcutsSVG from '../../../../assets/svg/navbar/shortcuts.svg?react';
import VariablesSVG from '../../../../assets/svg/navbar/variables.svg?react';
import PadlockSVG from '../../../../assets/svg/padlock.svg?react';
import PauseSVG from '../../../../assets/svg/pause.svg?react';
import PauseInCircleSVG from '../../../../assets/svg/pause-in-circle.svg?react';
import PersonSVG from '../../../../assets/svg/person.svg?react';
import PinSVG from '../../../../assets/svg/pin.svg?react';
import PlaySVG from '../../../../assets/svg/play.svg?react';
import PlusSVG from '../../../../assets/svg/plus.svg?react';
import PostgresSVG from '../../../../assets/svg/postgresql.svg?react';
import ProfileSVG from '../../../../assets/svg/profile.svg?react';
import PulseSVG from '../../../../assets/svg/pulse.svg?react';
import QuestionInCircleSVG from '../../../../assets/svg/question.svg?react';
import Queued from '../../../../assets/svg/queued.svg?react';
import RabbitMqSVG from '../../../../assets/svg/rabbitmq.svg?react';
import RedisSVG from '../../../../assets/svg/redis.svg?react';
import RegistrySVG from '../../../../assets/svg/registry.svg?react';
import RemoveSVG from '../../../../assets/svg/remove.svg?react';
import ResourceCriteriaSVG from '../../../../assets/svg/resource-criteria.svg?react';
import RobotSVG from '../../../../assets/svg/robot.svg?react';
import S3SVG from '../../../../assets/svg/s3.svg?react';
import SearchSVG from '../../../../assets/svg/search.svg?react';
import ServerlessSVG from '../../../../assets/svg/serverless.svg?react';
import SetActiveSVG from '../../../../assets/svg/set-active.svg?react';
import SkullSVG from '../../../../assets/svg/skull.svg?react';
import SSOSVG from '../../../../assets/svg/sso.svg?react';
import StarSVG from '../../../../assets/svg/star.svg?react';
import TagSVG from '../../../../assets/svg/tag.svg?react';
import ThreeDotsSVG from '../../../../assets/svg/three-dots.svg?react';
import TLSCertSVG from '../../../../assets/svg/tls-cert.svg?react';
import UnpinSVG from '../../../../assets/svg/unpin.svg?react';
import VirtualMachineSVG from '../../../../assets/svg/vm.svg?react';
import VolumeSVG from '../../../../assets/svg/volume.svg?react';
import WarningSVG from '../../../../assets/svg/warning.svg?react';
import WorkloadSVG from '../../../../assets/svg/workload.svg?react';

export const iconMap: Record<string, React.FC<React.SVGProps<SVGSVGElement>>> = {
  account: AccountSVG,
  aiven: AivenSVG,
  amqp: AMQPSVG,
  'api-tokens': ApiTokensSVG,
  'app-criteria': AppCriteriaSVG,
  applications: ApplicationsSVG,
  aws: AWSSVG,
  amazon: AmazonSVG,
  azure: AzureSVG,
  'azure-sbs': AzureSbsSVG,
  'base-env': BaseEnvSVG,
  bitbucket: BitbucketSVG,
  cassandra: CassandraSVG,
  checkmark: CheckMarkSVG,
  'circle-ci': CircleCISVG,
  clock: ClockSVG,
  close: CloseSVG,
  'cloud-accounts': CloudAccountsSVG,
  cloudflare: CloudflareSVG,
  'container-images': ContainerImagesSVG,
  comments: CommentsSVG,
  cookie: CookieSVG,
  copy: CopySVG,
  cross: CrossSVG,
  'default-workload': BaseSVG,
  delete: DeleteSVG,
  dns: DNSSVG,
  docs: DocsSVG,
  documents: DocumentsSVG,
  'double-right-arrow': DoubleRightArrowSVG,
  edit: EditSVG,
  elasticsearch: ElasticSearchSVG,
  emptyDir: EmptyDirSVG,
  'env-criteria': EnvCriteriaSVG,
  'environment-types': EnvironmentTypesSVG,
  environments: EnvironmentsSVG,
  gcp: GCPSVG,
  github: GitHubSVG,
  google: GoogleSVG,
  happy: HappySVG,
  'hide-menu': HideMenuSVG,
  history: HistorySVG,
  'horizontal-pod-autoscaler': HpaSVG,
  info: InfoSVG,
  ingress: IngressSVG,
  kafka: KafkaSVG,
  'k8s-namespace': NamespaceSVG,
  kubernetes: KubernetesSVG,
  'k8s-cluster': KubernetesSVG,
  link: LinkSVG,
  lock: LockSVG,
  logging: LoggingSVG,
  logout: LogoutSVG,
  mariadb: MariaDBSVG,
  mongodb: MongoDBSVG,
  mysql: MySQLSVG,
  'org-members': OrgMembers,
  organization: OrganizationSVG,
  padlock: PadlockSVG,
  pause: PauseSVG,
  'pause-in-circle': PauseInCircleSVG,
  pin: PinSVG,
  play: PlaySVG,
  plus: PlusSVG,
  postgres: PostgresSVG,
  profile: ProfileSVG,
  pulse: PulseSVG,
  rabbitmq: RabbitMqSVG,
  redis: RedisSVG,
  registries: RegistriesSVG,
  registry: RegistrySVG,
  remove: RemoveSVG,
  'resource-criteria': ResourceCriteriaSVG,
  resources: ResourcesSVG,
  s3: S3SVG,
  search: SearchSVG,
  shortcuts: ShortcutsSVG,
  skull: SkullSVG,
  sso: SSOSVG,
  star: StarSVG,
  tag: TagSVG,
  'three-dots': ThreeDotsSVG,
  'tls-cert': TLSCertSVG,
  variables: VariablesSVG,
  volume: VolumeSVG,
  warning: WarningSVG,
  workload: WorkloadSVG,
  'generic-resource': GenericResourceSVG,
  person: PersonSVG,
  robot: RobotSVG,
  filter: FilterSVG,
  question: QuestionInCircleSVG,
  'arrow-circle': ArrowCircleSVG,
  queued: Queued,
  'set-active': SetActiveSVG,
  unpin: UnpinSVG,
  'virtual-machine': VirtualMachineSVG,
  serverless: ServerlessSVG,
};

type CustomIconNames = keyof typeof iconMap;

interface CustomIconProps extends Partial<CustomIconComponentProps> {
  name: CustomIconNames;
}

export const CustomIcon = ({ name, ...rest }: CustomIconProps) => {
  return <Icon component={iconMap[name]} {...rest} />;
};
