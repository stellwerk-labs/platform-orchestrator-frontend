import { CheckCircleOutlined } from '@ant-design/icons';
import { theme, Typography } from 'antd';

const { Title, Paragraph, Text } = Typography;

const benefits = [
  'Ship 4x faster, with 75% less ops overhead',
  'Eliminate ticket ops forever',
  'From idea to production in hours',
  'One platform, any cloud, any compute',
];

/**
 *
 */
export function TrialSection() {
  // Ant design token
  const { token } = theme.useToken();
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: `0 ${token.paddingLG}px` }}>
      <Title level={2}>Get started</Title>

      <Paragraph style={{ fontSize: 16, color: token.colorTextSecondary }}>
        Get instant access to the Platform Orchestrator.
      </Paragraph>

      <ul style={{ listStyle: 'none', padding: 0, marginTop: 16 }}>
        {benefits.map((benefit) => (
          <li key={benefit} style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
            <CheckCircleOutlined
              style={{ color: token.colorSuccess, marginRight: 8, fontSize: 18 }}
            />
            <Text>{benefit}</Text>
          </li>
        ))}
      </ul>
    </div>
  );
}
