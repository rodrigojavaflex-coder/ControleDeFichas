import { registerAs } from '@nestjs/config';

export default registerAs('agentes', () => ({
  inhumas: {
    url: process.env.AGENTE_INHUMAS_URL || '',
    token: process.env.AGENTE_INHUMAS_TOKEN || '',
    unit: 2,
  },
  uberaba: {
    url: process.env.AGENTE_UBERABA_URL || '',
    token: process.env.AGENTE_UBERABA_TOKEN || '',
    unit: 2,
  },
  neropolis: {
    url: process.env.AGENTE_NEROPOLIS_URL || '',
    token: process.env.AGENTE_NEROPOLIS_TOKEN || '',
    unit: 4,
  },
}));

