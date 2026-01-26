/**
 * Execution/Fill Data Model
 * 
 * Represents a trade execution received from the rates/executions AMPS topic.
 */
export interface Execution {
  clientKey: number;
  DeskId: number;
  DstEE: string;
  ExchangeExecutionId: string;
  ExecutedQty: number;
  ExecutionId: number;
  ExecutionIdString: string;
  LeavesQty: number;
  OrderId: number;
  OrderIdString: string;
  ParentOrderId: number;
  ParentOrderIdString: string;
  Price: number;
  AlgoAccountId: number;
  ExecAccountId: number;
  ProductId: number;
  PublishTime: number;
  PublishTimeFormatted: string;
  Qty: number;
  Side: 'BUY' | 'SELL' | string;
  clmmStrategy: string;
  TransactionTime: number;
  UserId: string;
  Comment: string;
  updatedTime: number;
  CounterParty: string;
  Venue: string;
  TransactTime: number;
  SendingTime: number;
  LineHandlerTimeStamp: number;
}

/**
 * Execution Grid Row
 * 
 * Flattened representation of an Execution for ag-Grid display.
 */
export interface ExecutionGridRow {
  ExecutionIdString: string;
  OrderIdString: string;
  Side: string;
  Qty: number;
  ExecutedQty: number;
  LeavesQty: number;
  Price: number;
  ProductId: number;
  DstEE: string;
  Venue: string;
  UserId: string;
  CounterParty: string;
  TransactionTime: number;
  Comment: string;
}

/**
 * Transform raw Execution to grid row format
 */
export function transformExecutionToGridRow(execution: Execution): ExecutionGridRow {
  return {
    ExecutionIdString: execution.ExecutionIdString,
    OrderIdString: execution.OrderIdString,
    Side: execution.Side,
    Qty: execution.Qty,
    ExecutedQty: execution.ExecutedQty,
    LeavesQty: execution.LeavesQty,
    Price: execution.Price,
    ProductId: execution.ProductId,
    DstEE: execution.DstEE,
    Venue: execution.Venue,
    UserId: execution.UserId,
    CounterParty: execution.CounterParty,
    TransactionTime: execution.TransactionTime,
    Comment: execution.Comment,
  };
}
