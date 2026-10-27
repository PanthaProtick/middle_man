# 01: Decouple Frontend Test Assertions from Implementation Styling

**What to build:** Refactor frontend component tests in payment account creation and order parcel validation to assert user-observable accessibility roles, labels, and form behaviors rather than concrete inline CSS properties or rigid DOM hierarchies. Ensures responsive UI and layout styling refactors can proceed without triggering false test failures.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Payment account form tests verify provider selection and input values using accessible labels and element roles rather than checking literal inline style properties.
- [ ] Order creation parcel validation tests query required inputs, validation feedback, and submission behavior using accessible attributes rather than internal container hierarchy.
- [ ] All existing functional validations (required field errors, valid submissions, callback dispatches) remain thoroughly asserted and pass.
- [ ] Focused frontend tests execute and pass cleanly in offline environments.
