package core.utils;

import org.apache.log4j.Logger;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;

public class CommandUtils {
    private Logger logger = Logger.getLogger(CommandUtils.class);
    private String osType = null;

    public CommandUtils() {
        osType = System.getProperty("os.name");
    }

    private BufferedReader getBufferedReader(String command) throws IOException {
        List<String> commands = new ArrayList<>();
        if (osType.contains("Windows")) {
            commands.add("cmd");
            commands.add("/c");
        } else {
            commands.add("/bin/sh");
            commands.add("-c");
        }
        commands.add(command);
        ProcessBuilder builder = new ProcessBuilder(commands);
        final Process process = builder.start();
        InputStream is = process.getInputStream();
        InputStreamReader isr = new InputStreamReader(is);
        return new BufferedReader(isr);
    }

    public String executeCommand(String command) throws IOException {
        logger.debug("command to execute : " + command);
        BufferedReader br = getBufferedReader(command);
        String line = null;
        String cmdResponse = "";
        while ((line = br.readLine()) != null) {
            cmdResponse = String.format("%s%s\n", cmdResponse, line);
        }
        return cmdResponse;
    }

    public Process getProcessForCommand(String cmd) throws IOException {
        Process process;
        List<String> commands = new ArrayList<>();

        if (osType.contains("Windows")) {
            commands.add("cmd");
            commands.add("/c");
        } else {
            commands.add("/bin/sh");
            commands.add("-c");
        }
        commands.add(cmd);
        ProcessBuilder builder = new ProcessBuilder(commands);
        process = builder.start();
        return process;
    }

    public int getProcessId(String command) {
        try {
            Process process = getProcessForCommand(command);

            Class<?> processClass = process.getClass();
            Field fPid = processClass.getDeclaredField("pid");
            if (!fPid.isAccessible()) {
                fPid.setAccessible(true);
            }
            return fPid.getInt(process);
        } catch (Exception e) {
            return -1;
        }
    }

    public int getProcessId(Process process) {
        try {
            Class<?> processClass = process.getClass();
            Field fPid = processClass.getDeclaredField("pid");
            if (!fPid.isAccessible()) {
                fPid.setAccessible(true);
            }
            return fPid.getInt(process);
        } catch (Exception e) {
            return -1;
        }
    }
}
