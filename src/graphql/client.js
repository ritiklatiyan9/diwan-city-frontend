/**
 * Apollo Client — dashboard-only GraphQL layer.
 * Reuses existing JWT token from AuthContext.
 */
import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { ErrorLink } from '@apollo/client/link/error';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import eventBus from '../utils/eventBus';

const httpLink = new HttpLink({
  uri: `${import.meta.env.VITE_API_URL || 'http://localhost:80000'}/graphql`,
});

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('accessToken');
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});

const siteErrorLink = new ErrorLink(({ error }) => {
  if (CombinedGraphQLErrors.is(error)) {
    for (const item of error.errors) {
      if (item.extensions?.code === 'SITE_INACTIVE') {
        eventBus.emit('site-unavailable', { siteId: item.extensions.siteId });
      }
    }
  }
});

export const apolloClient = new ApolloClient({
  link: from([siteErrorLink, authLink, httpLink]),
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          kpiCards: {
            // Cache per siteId + range combo
            keyArgs: ['siteId', 'range', ['start', 'end']],
          },
          revenueVsExpense: {
            keyArgs: ['siteId', 'range', ['start', 'end'], 'resolution'],
          },
          profitTrend: {
            keyArgs: ['siteId', 'range', ['start', 'end'], 'resolution'],
          },
          verifyFinancialIntegrity: {
            keyArgs: ['siteId', 'range', ['start', 'end']],
          },
          plotPageData: {
            keyArgs: ['siteId'],
          },
          plotPaymentDetail: {
            keyArgs: ['plotId', 'siteId'],
          },
          registryBankChequePayments: {
            keyArgs: ['siteId'],
          },
        },
      },
    },
  }),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'no-cache',
    },
  },
});
