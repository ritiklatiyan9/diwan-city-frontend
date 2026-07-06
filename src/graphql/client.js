/**
 * Apollo Client — dashboard-only GraphQL layer.
 * Reuses existing JWT token from AuthContext.
 */
import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

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

export const apolloClient = new ApolloClient({
  link: from([authLink, httpLink]),
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
