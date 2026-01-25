feat: Integrate DriverConnect development plan and update admin.js

- Moved `gleaming-crafting-wreath.md` (DriverConnect Development Plan) into the `PTGLG/driverconnect` directory.
- Analyzed `admin/admin.js` for "Phase 1.1: Remove Dev Mode Bypass" as per the development plan.
- Confirmed that the specified dev mode bypass code (`urlParams.get('dev') === '1'`) was not found in `admin/admin.js`, suggesting it might have been previously addressed or is no longer present.