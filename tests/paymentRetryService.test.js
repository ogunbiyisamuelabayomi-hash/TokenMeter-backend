
jest.mock("../src/config/database", () => ({
  getConnection: jest.fn()
}));

const pool = require("../src/config/database");
const { schedulePaymentRetry } = require("../src/services/paymentRetryService");

jest.mock("../src/utils/clock", () => ({
  getCurrentTime: jest.fn()
}));

const { getCurrentTime } = require("../src/utils/clock");

describe("Payment Retry Service", () => {
  let connection;
  let queryMock;

  beforeEach(() => {
    jest.clearAllMocks();

    getCurrentTime.mockReturnValue(
      new Date("2026-11-03T10:00:00.000Z")
    );

    queryMock = jest.fn();

    connection = {
      query: queryMock,
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn()
    };

    pool.getConnection.mockResolvedValue(connection);
  });

  test("schedules the first retry after 1 day", async () => {
    queryMock
      .mockResolvedValueOnce([[
        { id: 1, invoice_id: 10, attempt_number: 1, status: "pending" }
      ]])
      .mockResolvedValueOnce([[{ customer_id: 5 }]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}]);

    const result = await schedulePaymentRetry(1);

    expect(result.retryInDays).toBe(1);
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("DATE_ADD"),
      ["2026-11-03 10:00:00", 1, 1]
    );
    expect(connection.commit).toHaveBeenCalled();
  });

  test("schedules the second retry after 2 more days", async () => {
    queryMock
      .mockResolvedValueOnce([[
        { id: 2, invoice_id: 10, attempt_number: 2, status: "pending" }
      ]])
      .mockResolvedValueOnce([[{ customer_id: 5 }]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}]);

    const result = await schedulePaymentRetry(2);

    expect(result.retryInDays).toBe(2);
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("DATE_ADD"),
      ["2026-11-03 10:00:00", 2, 2]
    );
  });

  test("schedules the third retry after 2 more days", async () => {
    queryMock
      .mockResolvedValueOnce([[
        { id: 3, invoice_id: 10, attempt_number: 3, status: "pending" }
      ]])
      .mockResolvedValueOnce([[{ customer_id: 5 }]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}]);

    const result = await schedulePaymentRetry(3);

    expect(result.retryInDays).toBe(2);
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("DATE_ADD"),
      ["2026-11-03 10:00:00", 2, 3]
    );
  });

  test("suspends subscription when the third retry fails", async () => {
    queryMock
      .mockResolvedValueOnce([[
        { id: 4, invoice_id: 10, attempt_number: 4, status: "pending" }
      ]])
      .mockResolvedValueOnce([[{ customer_id: 5 }]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}]);

    const result = await schedulePaymentRetry(4);

    expect(result.message).toBe(
      "Third retry failed. Subscription suspended."
    );

    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("status = 'suspended'"),
      [5]
    );

    expect(connection.commit).toHaveBeenCalled();
  });
});
