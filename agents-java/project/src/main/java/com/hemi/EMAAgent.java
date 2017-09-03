/*
 *  Copyright (c) 2017 Hemi Trickey; released under the "MIT license".
 *  See the LICENSE file packaged with this software for details.
 *
 */

package com.hemi;

import org.apache.commons.logging.Log;
import org.apache.commons.logging.LogFactory;

import com.amazonaws.AmazonClientException;
import com.amazonaws.auth.AWSCredentialsProvider;
import com.amazonaws.auth.profile.ProfileCredentialsProvider;
import com.amazonaws.services.kinesis.clientlibrary.interfaces.IRecordProcessorFactory;
import com.amazonaws.services.kinesis.clientlibrary.lib.worker.InitialPositionInStream;
import com.amazonaws.services.kinesis.clientlibrary.lib.worker.KinesisClientLibConfiguration;
import com.amazonaws.services.kinesis.clientlibrary.lib.worker.Worker;

public class EMAAgent {
    private static final Log LOG = LogFactory.getLog(EMAAgent.class);

    public static final String STREAM_NAME = "ema-event-stream";

    public static final String AGENT_NAME = "FrequentVisitorIdentificationAgent";

    // Initial position in the stream when the application starts up for the first time.
    // Position can be one of LATEST (most recent data) or TRIM_HORIZON (oldest available data)
    private static final InitialPositionInStream INITIAL_POSITION_IN_STREAM =
            InitialPositionInStream.LATEST;

    private static AWSCredentialsProvider credentialsProvider;

    private static void init() {
        /*
         * The ProfileCredentialsProvider will return your [default]
         * credential profile by reading from the credentials file located at
         * (~/.aws/credentials).
         */
        credentialsProvider = new ProfileCredentialsProvider();
        try {
            credentialsProvider.getCredentials();
        } catch (Exception e) {
            throw new AmazonClientException("Cannot load the credentials from the credential profiles file. "
                    + "Please make sure that your credentials file is at the correct "
                    + "location (~/.aws/credentials), and is in valid format.", e);
        }
    }

    public static void main(String[] args) {
        LOG.info("EMA Agent is starting up...");

        if (args.length > 0) {
            if (args[0].equals("--name")) {
                System.out.println(AGENT_NAME);
                System.exit(0);
            }
        }

        init();

        KinesisClientLibConfiguration kinesisClientLibConfiguratcion =
                new KinesisClientLibConfiguration(AGENT_NAME, STREAM_NAME, credentialsProvider,"1");

        kinesisClientLibConfiguratcion.withKinesisEndpoint("https://kinesis.us-east-2.amazonaws.com");
        kinesisClientLibConfiguratcion.withInitialPositionInStream(INITIAL_POSITION_IN_STREAM);

        IRecordProcessorFactory recordProcessorFactory = new EMAAgentRecordProcessorFactory();
        Worker worker = new Worker(recordProcessorFactory, kinesisClientLibConfiguratcion);

        LOG.info("Running " + AGENT_NAME + " to process stream " + STREAM_NAME + " as worker 1...\n");

        int exitCode = 0;
        try {
            worker.run();
        } catch (Throwable t) {
            System.err.println("Caught throwable while processing data.");
            t.printStackTrace();
            exitCode = 1;
        }
        System.exit(exitCode);

    }
}
