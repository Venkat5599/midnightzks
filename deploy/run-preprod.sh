#!/bin/bash
# Triện preprod overnight deploy — run from /root/midnightzks/deploy
# Sequence: wait for proof server -> register Night UTXOs for Dust -> deploy contract
# Logs: /root/midnightzks/preprod-register.log, /root/midnightzks/preprod-deploy.log
set -u

export NETWORK_ID=preprod
export NODE_OPTIONS="--max-old-space-size=5120"
export INDEXER_URI=https://indexer.preprod.midnight.network/api/v3/graphql
export INDEXER_WS_URI=wss://indexer.preprod.midnight.network/api/v3/graphql/ws
export NODE_URI=https://rpc.preprod.midnight.network
export PROOF_SERVER_URI=http://127.0.0.1:6300

cd /root/midnightzks/deploy || exit 1

echo "=== [$(date)] waiting for proof server on 6300 ==="
for i in $(seq 1 60); do
  if curl -s -o /dev/null -m 5 http://127.0.0.1:6300 2>/dev/null; then
    echo "proof server ready after ${i} tries"
    break
  fi
  sleep 2
done

echo "=== [$(date)] STEP 1/2: register Night UTXOs for Dust generation ==="
timeout 5400 node --experimental-strip-types src/register-dust.ts > /root/midnightzks/preprod-register.log 2>&1
REGISTER_RC=$?
echo "=== [$(date)] register-dust exit: $REGISTER_RC ==="
tail -20 /root/midnightzks/preprod-register.log

if [ "$REGISTER_RC" -ne 0 ]; then
  echo "REGISTER FAILED — aborting before deploy"
  exit 1
fi

echo "=== [$(date)] STEP 2/2: deploy contract ==="
timeout 7200 node --experimental-strip-types src/deploy.ts > /root/midnightzks/preprod-deploy.log 2>&1
DEPLOY_RC=$?
echo "=== [$(date)] deploy exit: $DEPLOY_RC ==="
tail -25 /root/midnightzks/preprod-deploy.log

if [ "$DEPLOY_RC" -ne 0 ]; then
  echo "DEPLOY FAILED"
  exit 1
fi

echo "=== [$(date)] DONE. Contract record: ==="
cat /root/midnightzks/deploy/deployment.json 2>/dev/null || echo "(no deployment.json found)"
echo "ALL_DONE"