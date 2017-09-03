
# EMA Demo

This simple demonstration project shows off the EMA architectural approach.
EMA is the *emergent microservice architecture*.

To make the demonstration more complete, this project uses the Amazon Kinesis
service for event streaming, and it provides six independent agents written in
two languages: Java and JavaScript (via node.js).

All original code in this repository is copyright (c) 2017 Hemi Trickey, and
is freely licensed under the MIT license. The text of this license is found in
the file named LICENSE. After installing and preparing to run the code,
third-party modules will also be downloaded and installed here; you use those
under the licenses of their respective copyright holders.

## Building and Preparing

You run the demo directly out of this directory, after a few steps to load the
JavaScript library dependencies and compile the Java.

If you don't care about the Java agent, you can skip it. You do need to
prepare the JavaScript code, however, because the tools which generate the
simulated user activity and watch the resulting event stream are both written
in JavaScript.

### Amazon Web Services

This demo uses [AWS Kinesis Streams][kin] as the backbone event stream. The 
concept of EMA is generic, and not tied to any particular event transport 
mechanism or API, but Kinesis illustrates how a scalable and
application-independent event system can serve as the backbone of an EMA-based
design.

To run the demo, you must have:

- An AWS account
- A single Kinesis stream set up, named `ema-event-stream`. The stream must be
  created in the `us-east-2` region.
- A set of credentials, stored in `~/.aws` as usual, for an [IAM][iam]
  (Identity and Access Management) user with full permissions for that stream

Setup of AWS credentials and configuration of `~/.aws` is not difficult, but
if you are unfamiliar with it, it requires much more explanation than belongs
here. Refer to Amazon's documentation for further details.

### JavaScript

The JavaScript agent code requires a recent version of [Node.js][njs]; it was
developed and tested on v8.4.0; you can verify that you have Node.js by
running `node -v` at the command line.

All other required libraries are captured in the `package.json` file, and can
be automatically fetched by running:

    npm install

Assuming there were no problems here, you're good to go with the JavaScript
tools and agents.

### Java

The Java agent code requires the [Java 8 or newer development kit][jdk] and
[Apache Maven][mvn] to get started, so make sure you have them installed. (You
can test by running `mvn -v` at the command line.) All other dependencies are
automatically downloaded and built into the agent's final executable JAR file,
so you don't need any other prerequisites.

To build the final JAR file and place it in the correct location, simply do

    cd agents-java/project
    ./build.sh

Internally, `build.sh` just runs Maven to build (`mvn package`) and then
copies the final JAR file to the right place.

## Running the System

This demo system consists of a user activity simulator, which produces events,
a set of agents, which react to and produce events, and scripts which watch
the event stream and print them out to your terminal.

For simplicity, just run

    ./ema

This is a Bash shell script which brings everything up and lets you monitor it
from the terminal.

To play around on a finer-grained level, adding or removing agents at any
time, you can manually launch them. Refer to the `ema` script for details.


 [kin]: https://aws.amazon.com/kinesis/streams/
 [iam]: https://aws.amazon.com/iam/
 [njs]: https://nodejs.org
 [jdk]: http://www.oracle.com/technetwork/java/javase/downloads/jdk8-downloads-2133151.html
 [mvn]: https://maven.apache.org



