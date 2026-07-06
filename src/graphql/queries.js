/**
 * GraphQL Queries — all dashboard analytics operations.
 */
import { gql } from '@apollo/client';

export const GET_KPI_CARDS = gql`
  query GetKpiCards($siteId: ID!, $range: DateRange!, $excludeOldPlots: Boolean) {
    kpiCards(siteId: $siteId, range: $range, excludeOldPlots: $excludeOldPlots) {
      totalRevenue
      totalExpense
      netProfit
      profitMargin
      outstanding
      cashflow
      personalLedgerCredit
      imprestGiven
      registryPayments
      registryPaymentsCount
      registryPaymentsNew
      registryPaymentsOld
      registryPaymentsNewCount
      registryPaymentsOldCount
      imprestDistribution {
        subAdminId
        recipientName
        totalAmount
        allocationCount
      }
      imprestPairs {
        giverId
        giverName
        giverRole
        receiverId
        receiverName
        receiverRole
        totalAmount
        allocationCount
      }
      breakdown {
        module
        debit
        credit
        count
      }
      cashflowDetail {
        incoming
        outgoing
        net
      }
      outstandingDetail {
        given
        returned
        pending
      }
    }
  }
`;

export const VERIFY_INTEGRITY = gql`
  query VerifyIntegrity($siteId: ID!, $range: DateRange!) {
    verifyFinancialIntegrity(siteId: $siteId, range: $range) {
      passed
      runA {
        totalRevenue
        totalExpense
        netProfit
        profitMargin
        outstanding
        cashflow
      }
      runB {
        totalRevenue
        totalExpense
        netProfit
        profitMargin
        outstanding
        cashflow
      }
      discrepancies {
        kpi
        runAValue
        runBValue
        diff
        severity
      }
      checkedAt
      queriesUsed
    }
  }
`;

export const GET_REVENUE_VS_EXPENSE = gql`
  query GetRevenueVsExpense($siteId: ID!, $range: DateRange!, $resolution: Resolution, $excludeOldPlots: Boolean) {
    revenueVsExpense(siteId: $siteId, range: $range, resolution: $resolution, excludeOldPlots: $excludeOldPlots) {
      date
      label
      revenue
      expense
    }
  }
`;

export const GET_PROFIT_TREND = gql`
  query GetProfitTrend($siteId: ID!, $range: DateRange!, $resolution: Resolution, $excludeOldPlots: Boolean) {
    profitTrend(siteId: $siteId, range: $range, resolution: $resolution, excludeOldPlots: $excludeOldPlots) {
      date
      label
      value
    }
  }
`;

export const GET_EXPENSES_BY_CATEGORY = gql`
  query GetExpensesByCategory($siteId: ID!, $range: DateRange!, $top: Int) {
    expensesByCategory(siteId: $siteId, range: $range, top: $top) {
      category
      amount
    }
  }
`;

export const GET_EXPENSES_PAGE_DATA = gql`
  query GetExpensesPageData($siteId: ID!, $page: Int, $limit: Int, $filters: ExpensesPageFiltersInput) {
    expensesPageData(siteId: $siteId, page: $page, limit: $limit, filters: $filters, includeBreakdowns: false) {
      expenses {
        id
        original_id
        site_id
        date
        from_entity
        to_entity
        payment_mode
        debit
        credit
        balance
        remark
        account_no
        branch
        category
        status
        approved_by
        approved_at
        approved_by_name
        created_by
        created_by_name
        created_at
        updated_at
        assigned_user_id
        assigned_user_name
        assigned_admin_id
        assigned_admin_name
        voucher_url
        bill_url
        source
        cheque_no
        cheque_status
        verifyUrl
      }
      summary {
        total_debit
        total_credit
        total_count
      }
      pagination {
        totalItems
        totalPages
        currentPage
        itemsPerPage
      }
    }
  }
`;

export const GET_EXPENSES_BREAKDOWN = gql`
  query GetExpensesBreakdown($siteId: ID!, $filters: ExpensesPageFiltersInput) {
    expensesBreakdown(siteId: $siteId, filters: $filters) {
      categoryBreakdown {
        category
        total_debit
        total_credit
        entries
      }
    }
  }
`;

// ── Plot Payments Queries ──

export const GET_PLOT_PAGE_DATA = gql`
  query GetPlotPageData($siteId: ID!) {
    plotPageData(siteId: $siteId) {
      plots {
        id
        site_id
        plot_no
        block
        buyer_name
        plot_size
        plot_size_mtr
        plot_rate
        sale_price
        registry_area
        circle_rate
        to_receive_bank
        first_installment
        booking_by
        booking_date
        status
        notes
        plot_tag
        team
        plot_commission
        commission_enabled
        commission_type
        commission_value
        commission_rate
        original_plot_rate
        discount_rate
        plc_charges
        installments_enabled
        interest_enabled
        interest_rate
        interest_type
        grace_period_days
        free_to_sale_days
        assigned_admin_id
        created_by
        total_received
        received_bank
        received_cash
        payment_count
        payment_buyer_names
        payment_booked_bys
      }
      autocomplete {
        buyerNames
        paymentFroms
        bankDetails
        narrations
        receivedBys
        bookedBys
        members {
          name
          phone
          team
          memberType
        }
      }
    }
  }
`;

export const GET_PLOT_PAYMENT_DETAIL = gql`
  query GetPlotPaymentDetail($plotId: ID!, $siteId: ID!) {
    plotPaymentDetail(plotId: $plotId, siteId: $siteId) {
      payments {
        id
        plot_id
        site_id
        date
        payment_from
        payment_type
        bank_details
        bank_name
        branch
        narration
        amount
        voucher_url
        assigned_admin_id
        buyer_name
        booked_by
        received_by
        cheque_no
        cheque_status
        status
        approved_by
        approved_at
        created_by
        created_by_name
        created_at
        source
      }
      plot {
        id
        site_id
        plot_no
        block
        buyer_name
        plot_size
        plot_size_mtr
        plot_rate
        sale_price
        registry_area
        circle_rate
        to_receive_bank
        first_installment
        booking_by
        booking_date
        status
        notes
        plot_tag
        team
        plot_commission
        commission_enabled
        commission_type
        commission_value
        commission_rate
        original_plot_rate
        discount_rate
        installments_enabled
        interest_enabled
        interest_rate
        interest_type
        grace_period_days
        free_to_sale_days
        assigned_admin_id
        total_received
        received_bank
        received_cash
        payment_count
      }
      fromBreakdown {
        payment_from
        entries
        total_amount
      }
      receivedByBreakdown {
        received_by
        entries
        total_amount
      }
      installments {
        id
        plot_id
        installment_name
        amount
        due_date
        sort_order
        paid_amount
      }
    }
  }
`;

export const INVALIDATE_PLOT_CACHE = gql`
  mutation InvalidatePlotCache($siteId: ID!) {
    invalidatePlotCache(siteId: $siteId)
  }
`;

export const GET_REGISTRY_BANK_CHEQUE_PAYMENTS = gql`
  query GetRegistryBankChequePayments($siteId: ID!) {
    registryBankChequePayments(siteId: $siteId) {
      id
      plot_id
      plot_no
      customer_name
      customer_phone
      date
      amount
      payment_type
      payment_from
      narration
      bank_details
      mapped_registry_payment_id
    }
  }
`;
