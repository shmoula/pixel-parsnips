import '@testing-library/jest-dom';
// Type augmentation: extends Vi.Assertion with toHaveNoViolations types
import 'vitest-axe/extend-expect';
// Runtime registration of the vitest-axe matcher
import { expect } from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const axeMatchers: any = require('vitest-axe/matchers');
expect.extend(axeMatchers);
