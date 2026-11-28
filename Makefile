.PHONY: start ios android typecheck lint test check check-fixtures e2e

start:
	npm start
ios:
	npm run ios
android:
	npm run android
typecheck:
	npm run typecheck
lint:
	npm run lint
test:
	npm test
check-fixtures:
	npm run check:fixtures
check:
	npm run check
e2e:
	npm run e2e
