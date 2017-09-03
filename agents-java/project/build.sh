
if ! command -v mvn ; then
  echo 'Cannot execute "mvn"; is Apache Maven installed?' >&2
  exit 1
fi

echo building Java agent...
mvn -q package && cp target/agent-frequent-visitor-identification.jar ../ \
  && echo done


